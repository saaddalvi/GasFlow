import { billSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

/** The agency, with cylinders at the shop and with a refiller. */
async function start() {
  const agency = await startAgency();
  const { shop, asLines, enter, addParty } = agency;
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 10 },
    { gas: "Medical oxygen", fillState: "defective", quantity: 4 },
  ]);
  const refiller = await addParty("refiller", "Zenith Gases");
  await enter(refiller.id, [{ gas: "Medical oxygen", fillState: "empty", quantity: 6 }]);
  const oxygen = (quantity: number) =>
    asLines([{ gas: "Medical oxygen", fillState: "defective", quantity }]);
  return { ...agency, refiller, oxygen };
}

test("an admin writes off cylinders from the shop, and the totals fall", async () => {
  const { admin, shop, oxygen, writeOffFor, postBill, viewBill, figures } = await start();

  const response = await postBill(
    writeOffFor({ notes: "  Failed the pressure test.  ", lines: oxygen(3) }),
    admin,
  );

  expect(response.statusCode).toBe(201);
  const writtenOff = billSchema.parse(response.json());
  expect(writtenOff).toMatchObject({
    type: "write_off",
    number: "WOF-20261126-001",
    paperKind: null,
    date: "2026-11-26",
    status: "posted",
    from: { id: shop.id, type: "shop" },
    to: null,
    vehicle: null,
    writeOffReason: "scrapped",
    notes: "Failed the pressure test.",
    lines: [{ gas: { name: "Medical oxygen" }, fillState: "defective", quantity: 3 }],
    enteredBy: { displayName: "Asha Patil" },
    returns: null,
  });
  expect(await viewBill(writtenOff.id)).toEqual(writtenOff);
  expect(await figures("Medical oxygen")).toEqual({
    shop: { filled: 10, empty: 0, defective: 1 },
    customers: 0,
    refillers: 6,
    total: 17,
  });
});

test("an admin writes off cylinders lost by a refiller", async () => {
  const { admin, refiller, oxygen, writeOffFor, postBill, figures } = await start();

  const response = await postBill(
    writeOffFor({ refillerId: refiller.id, writeOffReason: "lost", lines: oxygen(2) }),
    admin,
  );

  expect(response.statusCode).toBe(201);
  expect(billSchema.parse(response.json())).toMatchObject({
    from: { id: refiller.id, type: "refiller" },
    to: null,
    writeOffReason: "lost",
    notes: null,
  });
  expect(await figures("Medical oxygen")).toEqual({
    shop: { filled: 10, empty: 0, defective: 4 },
    customers: 0,
    refillers: 4,
    total: 18,
  });
});

test("writing off more than is recorded leaves a count below zero", async () => {
  const { admin, oxygen, writeOffFor, postBill, figures } = await start();

  const response = await postBill(writeOffFor({ lines: oxygen(5) }), admin);

  expect(response.statusCode).toBe(201);
  expect(await figures("Medical oxygen")).toMatchObject({ shop: { defective: -1 }, total: 15 });
});

test.each([
  ["no reason", { writeOffReason: undefined }, "Choose scrapped or lost."],
  ["some other reason", { writeOffReason: "sold" }, "Choose scrapped or lost."],
  // The shop is asked for outright, so that leaving the refiller out is no slip.
  ["no word on where from", { refillerId: undefined }, "Choose a refiller."],
])("a write-off with %s is refused", async (_case, change, message) => {
  const { admin, writeOffFor, postBill, figures } = await start();

  const response = await postBill(writeOffFor(change), admin);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  expect(await figures("Medical oxygen")).toMatchObject({ total: 20 });
});

// A customer's cylinders are written off against a bill, which is done elsewhere.
test.each(["customer", "supplier"] as const)(
  "a write-off from a %s is not taken here",
  async (type) => {
    const { admin, addParty, writeOffFor, postBill, figures } = await start();
    const party = await addParty(type, "City Hospital");

    const response = await postBill(writeOffFor({ refillerId: party.id }), admin);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "City Hospital is not a refiller. A write-off is from the shop or a refiller.",
    });
    expect(await figures("Medical oxygen")).toMatchObject({ total: 20 });
  },
);

test("staff who are not admins cannot write off cylinders", async () => {
  const { staff, writeOffFor, postBill, figures } = await start();

  const response = await postBill(writeOffFor(), staff);

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: "Only an admin can write off cylinders." });
  expect(await figures("Medical oxygen")).toMatchObject({ total: 20 });
});

test("each kind is numbered in its own series, by date", async () => {
  const { admin, writeOffFor, addCylindersFor, postBill } = await start();
  const numbered = async (payload: object) =>
    billSchema.parse((await postBill(payload, admin)).json()).number;

  expect(await numbered(writeOffFor())).toBe("WOF-20261126-001");
  expect(await numbered(addCylindersFor())).toBe("ADD-20261126-001");
  expect(await numbered(writeOffFor())).toBe("WOF-20261126-002");
  expect(await numbered(addCylindersFor())).toBe("ADD-20261126-002");
  expect(await numbered(writeOffFor({ date: "2026-11-02" }))).toBe("WOF-20261102-001");
});

test("write-offs saved at the same moment each get their own number", async () => {
  const { admin, writeOffFor, postBill } = await start();

  const responses = await Promise.all(
    Array.from({ length: 5 }, () => postBill(writeOffFor(), admin)),
  );

  expect(responses.map((response) => response.statusCode)).toEqual([201, 201, 201, 201, 201]);
  expect(responses.map((response) => billSchema.parse(response.json()).number).sort()).toEqual(
    [1, 2, 3, 4, 5].map((each) => `WOF-20261126-00${each}`),
  );
});

test.each(["write_off", "add_cylinders"] as const)(
  "no %s bill is dated before the start date",
  async (type) => {
    const { admin, writeOffFor, addCylindersFor, postBill } = await start();
    const payload = type === "write_off" ? writeOffFor : addCylindersFor;

    const response = await postBill(payload({ date: "2026-10-31" }), admin);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      message: "A bill cannot be dated before the start date.",
    });
  },
);

test("an admin corrects a write-off, and the earlier version is kept", async () => {
  const agency = await start();
  const { admin, shop, refiller, oxygen, writeOffFor, postBill, correct, figures } = agency;
  const writtenOff = billSchema.parse((await postBill(writeOffFor(), admin)).json());

  const atRefiller = await correct(writtenOff, {
    refillerId: refiller.id,
    writeOffReason: "lost",
    lines: oxygen(5),
  });

  expect(atRefiller).toMatchObject({
    id: writtenOff.id,
    number: "WOF-20261126-001",
    from: { id: refiller.id },
    to: null,
    writeOffReason: "lost",
    lines: [{ quantity: 5 }],
    lastCorrection: { correctedBy: { displayName: "Asha Patil" } },
    earlierVersions: [
      { from: { id: shop.id }, to: null, writeOffReason: "scrapped", lines: [{ quantity: 2 }] },
    ],
  });
  expect(await figures("Medical oxygen")).toMatchObject({
    shop: { defective: 4 },
    refillers: 1,
    total: 15,
  });

  const atShop = await correct(atRefiller, { refillerId: null });

  expect(atShop.from).toMatchObject({ id: shop.id });
  expect(await figures("Medical oxygen")).toMatchObject({
    shop: { defective: -1 },
    refillers: 6,
    total: 15,
  });
});

test("a change of reason alone is a correction", async () => {
  const { admin, writeOffFor, postBill, correct } = await start();
  const writtenOff = billSchema.parse((await postBill(writeOffFor(), admin)).json());

  const corrected = await correct(writtenOff, { writeOffReason: "lost" });

  expect(corrected.earlierVersions).toMatchObject([{ writeOffReason: "scrapped" }]);
  // And saying the same again is none.
  expect((await correct(corrected, {})).earlierVersions).toHaveLength(1);
});

test("a write-off cannot be corrected into another type of bill", async () => {
  const { admin, writeOffFor, addCylindersFor, postBill, postCorrection } = await start();
  const writtenOff = billSchema.parse((await postBill(writeOffFor(), admin)).json());

  const response = await postCorrection(writtenOff, addCylindersFor(), admin);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "The type of a bill cannot be changed. Cancel it and enter it again.",
  });
});

test.each([
  ["write_off", "a write-off", { shop: { defective: 2 }, total: 18 }],
  ["add_cylinders", "an add cylinders bill", { shop: { empty: 5 }, total: 25 }],
] as const)(
  "staff cannot correct or cancel a %s bill, even one they entered today",
  async (type, name, standing) => {
    const agency = await start();
    const { identity, signIn, writeOffFor, addCylindersFor, postBill, viewBill } = agency;
    const former = await signIn({ displayName: "Meena Iyer", isAdmin: true });
    const payload = type === "write_off" ? writeOffFor() : addCylindersFor();
    const saved = billSchema.parse((await postBill(payload, former)).json());
    identity.removeAdmin(former.identityId);

    for (const person of [former, agency.staff]) {
      const correction = await agency.postCorrection(saved, agency.correctionFor(saved), person);
      const cancellation = await agency.postCancel(saved, undefined, person);

      expect(correction.statusCode).toBe(403);
      expect(correction.json()).toMatchObject({ message: `Only an admin can correct ${name}.` });
      expect(cancellation.statusCode).toBe(403);
      expect(cancellation.json()).toMatchObject({ message: `Only an admin can cancel ${name}.` });
    }
    expect(await viewBill(saved.id)).toEqual(saved);
    expect(await agency.figures("Medical oxygen")).toMatchObject(standing);
  },
);

test("an admin cancels a write-off, and the totals rise back", async () => {
  const { admin, refiller, oxygen, writeOffFor, postBill, cancel, figures } = await start();
  const payload = writeOffFor({ refillerId: refiller.id, lines: oxygen(6) });
  const writtenOff = billSchema.parse((await postBill(payload, admin)).json());

  const cancelled = await cancel(writtenOff);

  expect(cancelled).toMatchObject({ status: "cancelled", writeOffReason: "scrapped" });
  expect(await figures("Medical oxygen")).toMatchObject({ refillers: 6, total: 20 });
});
