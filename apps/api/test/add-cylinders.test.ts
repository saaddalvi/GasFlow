import { billSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

test("an admin adds cylinders to the shop, and the totals rise", async () => {
  const { admin, shop, asLines, addCylindersFor, postBill, viewBill, figures } =
    await startAgency();

  const response = await postBill(
    addCylindersFor({
      notes: "  Bought new.  ",
      lines: asLines([
        { gas: "Medical oxygen", fillState: "empty", quantity: 10 },
        { gas: "Medical oxygen", fillState: "filled", quantity: 2 },
        { gas: "Argon", fillState: "defective", quantity: 1 },
      ]),
    }),
    admin,
  );

  expect(response.statusCode).toBe(201);
  const added = billSchema.parse(response.json());
  expect(added).toMatchObject({
    type: "add_cylinders",
    number: "ADD-20261126-001",
    paperKind: null,
    date: "2026-11-26",
    status: "posted",
    from: null,
    to: { id: shop.id, type: "shop" },
    vehicle: null,
    notes: "Bought new.",
    lines: [
      { gas: { name: "Medical oxygen" }, fillState: "empty", quantity: 10 },
      { gas: { name: "Medical oxygen" }, fillState: "filled", quantity: 2 },
      { gas: { name: "Argon" }, fillState: "defective", quantity: 1 },
    ],
    enteredBy: { displayName: "Asha Patil" },
    returns: null,
  });
  expect(await viewBill(added.id)).toEqual(added);
  expect(await figures("Medical oxygen")).toEqual({
    shop: { filled: 2, empty: 10, defective: 0 },
    customers: 0,
    refillers: 0,
    total: 12,
  });
  expect(await figures("Argon")).toMatchObject({ shop: { defective: 1 }, total: 1 });
});

test("a supplier named on the bill never counts as holding cylinders", async () => {
  const { admin, shop, addParty, addCylindersFor, postBill, report } = await startAgency();
  const supplier = await addParty("supplier", "Sharp Cylinders");

  const response = await postBill(addCylindersFor({ supplierId: supplier.id }), admin);

  expect(response.statusCode).toBe(201);
  expect(billSchema.parse(response.json())).toMatchObject({
    from: { id: supplier.id, name: "Sharp Cylinders", type: "supplier" },
    to: { id: shop.id },
  });
  const { rows } = await report();
  expect(rows.find((row) => row.gas.name === "Medical oxygen")).toMatchObject({
    shop: { filled: 0, empty: 5, defective: 0 },
    customers: 0,
    refillers: 0,
    total: 5,
  });
  // Nor is it anywhere else as five cylinders short.
  const counts = rows.flatMap(({ shop, customers, refillers, total }) => [
    ...Object.values(shop),
    customers,
    refillers,
    total,
  ]);
  expect(counts.filter((count) => count < 0)).toEqual([]);
});

test.each([
  ["a customer", "customer"],
  ["a refiller", "refiller"],
] as const)("cylinders cannot be added from %s", async (_case, type) => {
  const { admin, addParty, addCylindersFor, postBill, bills } = await startAgency();
  const party = await addParty(type, "City Hospital");

  const response = await postBill(addCylindersFor({ supplierId: party.id }), admin);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "City Hospital is not a supplier. Cylinders are added from a supplier.",
  });
  expect(await bills()).toMatchObject({ total: 0 });
});

test("cylinders cannot be added from an inactive supplier", async () => {
  const { app, admin, addParty, addCylindersFor, postBill, bills } = await startAgency();
  const supplier = await addParty("supplier", "Sharp Cylinders");
  await app.inject({
    method: "PATCH",
    url: `/api/parties/${supplier.id}`,
    headers: admin.headers,
    payload: { active: false },
  });

  const response = await postBill(addCylindersFor({ supplierId: supplier.id }), admin);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "Sharp Cylinders is inactive. Make it active first.",
  });
  expect(await bills()).toMatchObject({ total: 0 });
});

test("staff who are not admins cannot add cylinders", async () => {
  const { staff, addCylindersFor, postBill, bills, report } = await startAgency();

  const response = await postBill(addCylindersFor(), staff);

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ message: "Only an admin can add cylinders." });
  expect(await bills()).toMatchObject({ total: 0 });
  expect((await report()).rows.every((row) => row.total === 0)).toBe(true);
});

test("an admin corrects an add cylinders bill, and the earlier version is kept", async () => {
  const agency = await startAgency();
  const { admin, shop, addParty, asLines, addCylindersFor, postBill, correct } = agency;
  const first = await addParty("supplier", "Sharp Cylinders");
  const second = await addParty("supplier", "Bharat Vessels");
  const added = billSchema.parse(
    (await postBill(addCylindersFor({ supplierId: first.id }), admin)).json(),
  );

  const corrected = await correct(added, {
    supplierId: second.id,
    date: "2026-11-20",
    notes: "Counted again.",
    lines: asLines([{ gas: "Medical oxygen", fillState: "empty", quantity: 8 }]),
  });

  expect(corrected).toMatchObject({
    id: added.id,
    // The app issued the number, which stays though the date does not.
    number: "ADD-20261126-001",
    date: "2026-11-20",
    from: { id: second.id },
    to: { id: shop.id },
    notes: "Counted again.",
    lines: [{ quantity: 8 }],
    lastCorrection: { correctedBy: { displayName: "Asha Patil" } },
    earlierVersions: [
      { date: "2026-11-26", from: { id: first.id }, notes: null, lines: [{ quantity: 5 }] },
    ],
  });
  expect(await agency.figures("Medical oxygen", "date=2026-11-20")).toMatchObject({
    shop: { empty: 8 },
    total: 8,
  });

  // The supplier can be taken off again, and named again.
  expect((await correct(corrected, { supplierId: null })).from).toBeNull();
  const named = await correct(await agency.viewBill(added.id), { supplierId: first.id });
  expect(named.from).toMatchObject({ id: first.id });
  expect(named.earlierVersions).toHaveLength(3);
  expect(await agency.figures("Medical oxygen")).toMatchObject({ total: 8 });
});

test("a correction cannot newly name anyone but a supplier", async () => {
  const agency = await startAgency();
  const { admin, addParty, addCylindersFor, postBill, correctionFor, postCorrection } = agency;
  const refiller = await addParty("refiller", "Zenith Gases");
  const added = billSchema.parse((await postBill(addCylindersFor(), admin)).json());

  const response = await postCorrection(
    added,
    correctionFor(added, { supplierId: refiller.id }),
    admin,
  );

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "Zenith Gases is not a supplier. Cylinders are added from a supplier.",
  });
  expect(await agency.viewBill(added.id)).toEqual(added);
});

test("the totals rise from the bill's date on", async () => {
  const { admin, addCylindersFor, postBill, figures } = await startAgency();

  await postBill(addCylindersFor({ date: "2026-11-20" }), admin);

  expect(await figures("Medical oxygen", "date=2026-11-19")).toMatchObject({ total: 0 });
  expect(await figures("Medical oxygen", "date=2026-11-20")).toMatchObject({ total: 5 });
});

test("an admin cancels an add cylinders bill, and the totals fall back", async () => {
  const { admin, addCylindersFor, postBill, cancel, figures } = await startAgency();
  const added = billSchema.parse((await postBill(addCylindersFor(), admin)).json());

  const cancelled = await cancel(added, { reason: "duplicate_entry" });

  expect(cancelled).toMatchObject({
    status: "cancelled",
    cancellation: { reason: "duplicate_entry", cancelledBy: { displayName: "Asha Patil" } },
  });
  expect(await figures("Medical oxygen")).toMatchObject({ shop: { empty: 0 }, total: 0 });
  // The number the app issued is not issued again.
  const next = await postBill(addCylindersFor(), admin);
  expect(next.json()).toMatchObject({ number: "ADD-20261126-002" });
});

test("a correction may keep a supplier made inactive since", async () => {
  const { app, admin, addParty, addCylindersFor, postBill, correct } = await startAgency();
  const supplier = await addParty("supplier", "Sharp Cylinders");
  const added = billSchema.parse(
    (await postBill(addCylindersFor({ supplierId: supplier.id }), admin)).json(),
  );
  await app.inject({
    method: "PATCH",
    url: `/api/parties/${supplier.id}`,
    headers: admin.headers,
    payload: { active: false },
  });

  const corrected = await correct(added, { notes: "Checked." });

  expect(corrected).toMatchObject({ from: { id: supplier.id }, notes: "Checked." });
});

// Neither bill names anyone beside the shop, which a correction must not mistake
// for the shop having been named already.
test.each([
  ["add_cylinders", "supplierId", "supplier. Cylinders are added from a supplier."],
  ["write_off", "refillerId", "refiller. A write-off is from the shop or a refiller."],
] as const)(
  "correcting a bill of type %s cannot name the shop as its %s",
  async (type, field, rule) => {
    const agency = await startAgency();
    const { admin, shop, addCylindersFor, writeOffFor, postBill, correctionFor } = agency;
    const payload = type === "add_cylinders" ? addCylindersFor() : writeOffFor();
    const saved = billSchema.parse((await postBill(payload, admin)).json());

    const response = await agency.postCorrection(
      saved,
      correctionFor(saved, { [field]: shop.id }),
      admin,
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ message: `${shop.name} is not a ${rule}` });
    expect(await agency.viewBill(saved.id)).toEqual(saved);
  },
);
