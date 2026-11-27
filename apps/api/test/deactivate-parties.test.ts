import { partySchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

// The tests' clock stands at noon on 26 November 2026 in India, and the records
// begin on 1 November.

/** The agency, with a customer and the means to deactivate a party. */
async function start() {
  const agency = await startAgency();
  const { app, staff, get } = agency;
  const customer = await agency.addParty("customer", "City Hospital");

  /** Asks to change a party, as its page does to deactivate it. */
  const change = (party: { id: string }, payload: object = { active: false }) =>
    app.inject({
      method: "PATCH",
      url: `/api/parties/${party.id}`,
      headers: staff.headers,
      payload,
    });

  /** The party as its page shows it. */
  async function view(party: { id: string }) {
    return partySchema.parse((await get(`/api/parties/${party.id}`)).json());
  }

  /** Expects deactivating the party to be refused for this reason, and nothing to change. */
  async function expectRefused(party: { id: string }, message: string) {
    const response = await change(party);
    expect(response.json()).toMatchObject({ message });
    expect(response.statusCode).toBe(409);
    expect((await view(party)).active).toBe(true);
  }

  /** Expects the party to be deactivated. */
  async function deactivate(party: { id: string }) {
    const response = await change(party);
    expect(response.statusCode).toBe(200);
    expect((await view(party)).active).toBe(false);
  }

  return { ...agency, customer, change, view, expectRefused, deactivate };
}

test("a customer holding cylinders cannot be deactivated", async () => {
  const { customer, dispatch, enter, expectRefused, asLines } = await start();
  await enter(customer.id, [{ gas: "Argon", quantity: 2 }]);
  await dispatch(customer.id, {
    lines: asLines([
      { gas: "Medical oxygen", fillState: "filled", quantity: 4 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });

  await expectRefused(
    customer,
    "City Hospital cannot be deactivated. It holds 5 Medical oxygen and 2 Argon.",
  );
});

test("a refiller holding cylinders cannot be deactivated", async () => {
  const { addParty, send, expectRefused } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  await send(refiller.id);

  await expectRefused(refiller, "Zenith Gases cannot be deactivated. It holds 5 Medical oxygen.");
});

test("a party holding fewer than none of a gas cannot be deactivated", async () => {
  const { addParty, refillerReturn, expectRefused, asLines } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  await refillerReturn(refiller.id, {
    lines: asLines([
      { gas: "Medical oxygen", quantity: 3 },
      { gas: "Nitrogen", quantity: 1 },
      { gas: "Argon", quantity: 2 },
    ]),
  });

  await expectRefused(
    refiller,
    "Zenith Gases cannot be deactivated. It holds -3 Medical oxygen, -1 Nitrogen and -2 Argon.",
  );
});

test("gases that cancel each other out in the total still keep a party active", async () => {
  const { addParty, send, refillerReturn, expectRefused, asLines } = await start();
  const refiller = await addParty("refiller", "Zenith Gases");
  await send(refiller.id);
  await refillerReturn(refiller.id, { lines: asLines([{ gas: "Argon", quantity: 5 }]) });

  await expectRefused(
    refiller,
    "Zenith Gases cannot be deactivated. It holds 5 Medical oxygen and -5 Argon.",
  );
});

test("a customer with unmatched returns cannot be deactivated", async () => {
  const { customer, receive, unmatchedRow, expectRefused } = await start();
  await receive(customer.id, [], { unmatched: [unmatchedRow("Argon", 3)] });

  await expectRefused(
    customer,
    "City Hospital cannot be deactivated. It holds -3 Argon. It has 3 Argon unmatched.",
  );
});

test("unmatched returns keep a customer active even while it holds nothing", async () => {
  const { customer, receive, unmatchedRow, dispatch, expectRefused, pending } = await start();
  await receive(customer.id, [], { unmatched: [unmatchedRow("Medical oxygen", 2)] });
  await receive(customer.id, [], { unmatched: [unmatchedRow("Medical oxygen", 3)] });
  // The missing dispatch is entered, and nobody has matched the returns to it.
  await dispatch(customer.id);
  expect(await pending(customer.id)).toMatchObject([{ pending: 5 }]);

  await expectRefused(
    customer,
    "City Hospital cannot be deactivated. It has 5 Medical oxygen unmatched.",
  );
});

test("cylinders on a bill dated after today keep a party active", async () => {
  const { customer, dispatch, expectRefused } = await start();
  await dispatch(customer.id, { date: "2026-11-28" });

  await expectRefused(customer, "City Hospital cannot be deactivated. It holds 5 Medical oxygen.");
});

test("a refused deactivation changes nothing else that came with it", async () => {
  const { customer, dispatch, change, view } = await start();
  await dispatch(customer.id);

  const response = await change(customer, { name: "City Care", active: false });

  expect(response.statusCode).toBe(409);
  expect(await view(customer)).toEqual(customer);
});

test("a party holding cylinders can still be changed in other ways", async () => {
  const { customer, dispatch, change } = await start();
  await dispatch(customer.id);

  const response = await change(customer, { name: "City Care", active: true });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ name: "City Care", active: true });
});

test("a customer who has brought everything back can be deactivated", async () => {
  const { customer, dispatch, receive, against, deactivate } = await start();
  const sent = await dispatch(customer.id);
  await receive(customer.id, [against(sent, "Medical oxygen", 5)]);

  await deactivate(customer);
});

test("a customer whose cylinders are all written off can be deactivated", async () => {
  const { customer, dispatch, customerWriteOff, deactivate } = await start();
  const sent = await dispatch(customer.id);
  await customerWriteOff(customer.id, sent, "Medical oxygen", 5);

  await deactivate(customer);
});

test("a customer whose unmatched returns are matched can be deactivated", async () => {
  const { customer, receive, unmatchedRow, dispatch, match, against, deactivate } = await start();
  const returned = await receive(customer.id, [], {
    unmatched: [unmatchedRow("Medical oxygen", 5)],
  });
  const sent = await dispatch(customer.id);
  await match(returned, against(sent, "Medical oxygen", 5));

  await deactivate(customer);
});

test("what was cancelled does not keep a party active", async () => {
  const { customer, dispatch, receive, unmatchedRow, cancel, deactivate } = await start();
  await cancel(await dispatch(customer.id));
  await cancel(await receive(customer.id, [], { unmatched: [unmatchedRow("Argon", 3)] }));

  await deactivate(customer);
});

test("a supplier named on bills holds nothing, and can be deactivated", async () => {
  const { addParty, admin, addCylindersFor, postBill, deactivate } = await start();
  const supplier = await addParty("supplier", "Sharp Cylinders");
  await postBill(addCylindersFor({ supplierId: supplier.id }), admin);

  await deactivate(supplier);
});

test("an inactive party that has come to hold cylinders can still be edited", async () => {
  const { customer, dispatch, receive, against, deactivate, cancel, change } = await start();
  const sent = await dispatch(customer.id);
  const returned = await receive(customer.id, [against(sent, "Medical oxygen", 5)]);
  await deactivate(customer);
  await cancel(returned);

  const response = await change(customer, { mobile: "99300 55555", active: false });

  expect(response.statusCode).toBe(200);
});

// Which of two saves at once gets there first is left to chance, so the pair is
// sent several times over, on a customer of its own each time.
test("a dispatch and a deactivation sent at once cannot both succeed", async () => {
  const agency = await start();
  const { addParty, dispatchFor, postBill, change, view, openConnections } = agency;
  for (let time = 0; time < 5; time += 1) {
    const customer = await addParty("customer", `Clinic ${time}`);
    const payload = dispatchFor(customer.id);
    await openConnections();

    const [saved, deactivated] = await Promise.all([postBill(payload), change(customer)]);

    const sent = saved.statusCode === 201;
    expect([saved.statusCode, deactivated.statusCode]).toEqual(sent ? [201, 409] : [409, 200]);
    expect((await view(customer)).active).toBe(sent);
  }
});
