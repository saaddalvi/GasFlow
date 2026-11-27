import { expect, test } from "vitest";
import { startAgency } from "./support/agency";

// The tests' clock stands at noon on 26 November 2026 in India, and the records
// begin on 1 November unless a test sets them earlier.

/** The agency, with the means to download the backup as the menu does. */
async function start(options?: Parameters<typeof startAgency>[0]) {
  const agency = await startAgency(options);

  /** The file, as staff download it. */
  async function backup() {
    const response = await agency.get("/api/backup");
    expect(response.statusCode).toBe(200);
    return response.body;
  }

  return { ...agency, backup };
}

/** What a piece of the file reads as, without its markup. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The part of the file with this id. */
function partOf(file: string, id: string): string {
  const part = new RegExp(`<section id="${id}">(.*?)</section>`, "s").exec(file);
  expect(part, `The part "${id}"`).not.toBeNull();
  return part![1]!;
}

/** The rows of the table in a part, under its headings, each as what its cells say. */
function rowsOf(file: string, id: string): string[][] {
  const body = /<tbody>(.*?)<\/tbody>/s.exec(partOf(file, id))?.[1] ?? "";
  return [...body.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map(([, row]) =>
    [...row!.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map(([, cell]) => textOf(cell!)),
  );
}

test("staff download one HTML file, named for the day", async () => {
  const { get } = await start();

  const response = await get("/api/backup");

  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
  expect(response.headers["content-disposition"]).toBe(
    'attachment; filename="gasflow-backup-2026-11-26.html"',
  );
  expect(response.body).toMatch(/^<!doctype html>/);
});

test("a signed-out request is refused", async () => {
  const { app } = await start();

  const response = await app.inject({ method: "GET", url: "/api/backup" });

  expect(response.statusCode).toBe(401);
  expect(response.body).not.toContain("<!doctype html>");
});

test("the file says when it was generated, by the time in India", async () => {
  const { backup, clock } = await start();
  // A quarter past midnight in India, while it is still the day before in London.
  clock.set("2026-11-26T18:45:00.000Z");

  expect(textOf(await backup())).toContain("Generated on 27 Nov 2026, 12:15 am (India time).");
});

test("the file shows the shop's stock of each gas by fill state", async () => {
  const { shop, enter, addParty, dispatch, asLines, backup } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id, [
    { gas: "Medical oxygen", fillState: "filled", quantity: 20 },
    { gas: "Medical oxygen", fillState: "empty", quantity: 3 },
    { gas: "Argon", fillState: "defective", quantity: 2 },
  ]);
  await dispatch(customer.id, {
    lines: asLines([
      { gas: "Medical oxygen", quantity: 5 },
      // More than the shop has.
      { gas: "Argon", quantity: 1 },
    ]),
  });

  const rows = rowsOf(await backup(), "shop");

  // Filled, empty, defective and all of them.
  expect(rows).toContainEqual(["Medical oxygen", "15", "3", "0", "18"]);
  expect(rows).toContainEqual(["Argon", "-1", "0", "2", "1"]);
  // A gas there is none of is still listed.
  expect(rows).toContainEqual(["Nitrogen", "0", "0", "0", "0"]);
});

test("a retired gas is listed only while the shop has cylinders of it", async () => {
  const { app, admin, shop, addParty, enter, gas, backup } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id, [{ gas: "Argon", quantity: 2 }]);
  // Held, but not by the shop.
  await enter(customer.id, [{ gas: "Air", quantity: 1 }]);
  for (const name of ["Argon", "Nitrogen", "Air"]) {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/gases/${gas(name).id}`,
      headers: admin.headers,
      payload: { active: false },
    });
    expect(response.statusCode).toBe(200);
  }

  const file = await backup();
  const gases = rowsOf(file, "shop").map(([name]) => name);

  expect(gases).toContain("Argon");
  expect(gases).not.toContain("Nitrogen");
  expect(gases).not.toContain("Air");
  expect(rowsOf(file, "customers")).toEqual([["City Hospital", "Air 1", "1"]]);
});

test("the file lists every customer and refiller with what each holds now", async () => {
  const agency = await start();
  const { addParty, enter, dispatch, send, receive, against, asLines, backup } = agency;
  const hospital = await addParty("customer", "City Hospital");
  const works = await addParty("customer", "Apex Works");
  await addParty("customer", "Zenith Clinic");
  const refiller = await addParty("refiller", "Bharat Gases");
  await addParty("supplier", "Cylinder Mart");
  await enter(hospital.id, [{ gas: "Argon", quantity: 4 }]);
  const sent = await dispatch(hospital.id, { date: "2026-11-05" });
  await receive(hospital.id, [against(sent, "Medical oxygen", 2)]);
  await dispatch(works.id, { lines: asLines([{ gas: "Nitrogen", quantity: 1 }]) });
  await send(refiller.id);

  const file = await backup();

  // By name, with those holding nothing, and gas by gas in the order of the gases.
  expect(rowsOf(file, "customers")).toEqual([
    ["Apex Works", "Nitrogen 1", "1"],
    ["City Hospital", "Medical oxygen 3 Argon 4", "7"],
    ["Zenith Clinic", "Nothing", "0"],
  ]);
  expect(rowsOf(file, "refillers")).toEqual([["Bharat Gases", "Medical oxygen 5", "5"]]);
  // A supplier's cylinders are not counted.
  expect(partOf(file, "customers") + partOf(file, "refillers")).not.toContain("Cylinder Mart");
});

test("holdings and shop stock count every posted bill, even one dated after today", async () => {
  const { shop, addParty, enter, dispatch, cancel, backup } = await start();
  const customer = await addParty("customer", "City Hospital");
  await enter(shop.id, [{ gas: "Medical oxygen", quantity: 20 }]);
  await dispatch(customer.id, { date: "2026-12-01" });
  await cancel(await dispatch(customer.id));

  const file = await backup();

  expect(rowsOf(file, "customers")).toEqual([["City Hospital", "Medical oxygen 5", "5"]]);
  expect(rowsOf(file, "shop")).toContainEqual(["Medical oxygen", "15", "0", "0", "15"]);
});

test("a party's notes are shown, and that it is inactive", async () => {
  const { app, staff, addParty, deactivate, backup } = await start();
  const customer = await addParty("customer", "City Hospital");
  const response = await app.inject({
    method: "PATCH",
    url: `/api/parties/${customer.id}`,
    headers: staff.headers,
    payload: { notes: "Collect from the back gate." },
  });
  expect(response.statusCode).toBe(200);
  await deactivate(customer);

  expect(rowsOf(await backup(), "customers")).toEqual([
    ["City Hospital Inactive Collect from the back gate.", "Nothing", "0"],
  ]);
});

test("a section with no parties says so", async () => {
  const { backup } = await start();

  const file = await backup();

  expect(textOf(partOf(file, "customers"))).toContain("There are no customers.");
  expect(textOf(partOf(file, "refillers"))).toContain("There are no refillers.");
});

test("the file shows each bill with its parties, lines, vehicle and notes", async () => {
  const agency = await start();
  const { shop, addParty, addVehicle, dispatch, receive, against, asLines, backup } = agency;
  const customer = await addParty("customer", "City Hospital");
  const vehicle = await addVehicle({ plate: "MH 12 AB 1234", label: "Tempo" });
  const sent = await dispatch(customer.id, {
    number: "4501",
    paperKind: "cash_memo",
    date: "2026-11-20",
    vehicleId: vehicle.id,
    notes: "Gate pass taken.\nPay on Friday.",
    lines: asLines([
      { gas: "Argon", quantity: 2 },
      { gas: "Medical oxygen", fillState: "empty", quantity: 1 },
    ]),
  });
  const { id } = await receive(customer.id, [against(sent, "Argon", 1)], { slipNumber: "S-9" });
  const returned = await agency.viewBill(id);

  expect(rowsOf(await backup(), "bills")).toEqual([
    [
      "26 Nov 2026",
      `${returned.number} Return`,
      `City Hospital → ${shop.name}`,
      "Argon 1 empty",
      "Slip number: S-9",
    ],
    [
      "20 Nov 2026",
      "Cash memo 4501 Dispatch",
      `${shop.name} → City Hospital`,
      // In the order of the lines.
      "Argon 2 filled Medical oxygen 1 empty",
      "Vehicle: MH 12 AB 1234 (Tempo) Gate pass taken. Pay on Friday.",
    ],
  ]);
});

test("a bill with nobody on one side says so", async () => {
  const { shop, addCylindersFor, writeOffFor, admin, postBill, backup } = await start();
  for (const bill of [addCylindersFor({ date: "2026-11-25" }), writeOffFor()]) {
    expect((await postBill(bill, admin)).statusCode).toBe(201);
  }

  const rows = rowsOf(await backup(), "bills");

  expect(rows.map(([, bill, parties]) => [bill!.replace(/^\S+ /, ""), parties])).toEqual([
    ["Write-off · Scrapped", `${shop.name} → Written off`],
    ["Add cylinders", shop.name],
  ]);
});

test("a cancelled bill is listed, marked with why it was cancelled", async () => {
  const { addParty, dispatch, cancel, backup } = await start();
  const customer = await addParty("customer", "City Hospital");
  const bill = await dispatch(customer.id, { number: "4501" });
  await cancel(bill, { reason: "duplicate_entry", notes: "Same as 4500." });

  const [row] = rowsOf(await backup(), "bills");

  expect(row![1]).toBe("Bill 4501 Dispatch Cancelled");
  expect(row![4]).toBe("Cancelled: Duplicate entry Same as 4500.");
});

/** The bill numbers listed, from names such as "Bill 4501 Dispatch". */
const numbersIn = (file: string) => rowsOf(file, "bills").map(([, bill]) => bill!.split(" ")[1]);

test("the bills go back 60 days, today among them, and no further", async () => {
  const { addParty, dispatch, backup } = await start({ startDate: "2026-01-01" });
  const customer = await addParty("customer", "City Hospital");
  // 60 days before 26 November, then 59.
  await dispatch(customer.id, { number: "60-back", date: "2026-09-27" });
  await dispatch(customer.id, { number: "59-back", date: "2026-09-28" });
  await dispatch(customer.id, { number: "today", date: "2026-11-26" });

  const file = await backup();

  expect(numbersIn(file)).toEqual(["today", "59-back"]);
  // What an older bill sent is still held.
  expect(rowsOf(file, "customers")).toEqual([["City Hospital", "Medical oxygen 15", "15"]]);
});

test("the 60 days move on as midnight passes in India", async () => {
  const { addParty, dispatch, backup, clock } = await start({ startDate: "2026-01-01" });
  const customer = await addParty("customer", "City Hospital");
  await dispatch(customer.id, { number: "first", date: "2026-09-28" });
  await dispatch(customer.id, { number: "second", date: "2026-09-29" });

  clock.set("2026-11-26T18:29:59.000Z");
  const before = await backup();
  clock.set("2026-11-26T18:30:00.000Z");
  const after = await backup();

  expect(numbersIn(before)).toEqual(["second", "first"]);
  expect(numbersIn(after)).toEqual(["second"]);
});

test("a bill dated after today is listed too, as it is counted", async () => {
  const { addParty, dispatch, backup } = await start();
  const customer = await addParty("customer", "City Hospital");
  await dispatch(customer.id, { number: "ahead", date: "2026-12-01" });
  await dispatch(customer.id, { number: "today" });

  expect(numbersIn(await backup())).toEqual(["ahead", "today"]);
});

test("every bill of the 60 days is in the one file, however many", async () => {
  const { addParty, dispatch, backup } = await start();
  const customer = await addParty("customer", "City Hospital");
  // More than a page of any list.
  for (let saved = 0; saved < 51; saved += 1) {
    await dispatch(customer.id);
  }

  expect(rowsOf(await backup(), "bills")).toHaveLength(51);
});

test("the file needs nothing but itself, and carries its own styles", async () => {
  const { addParty, dispatch, backup } = await start();
  const customer = await addParty("customer", "City Hospital");
  await dispatch(customer.id);

  const file = await backup();

  expect(file).toContain('<meta charset="utf-8" />');
  expect(file).toMatch(/<style>[^<]*\.below-zero\s*\{/);
  // Nothing is fetched or run: no scripts, linked sheets, pictures or frames,
  // and no address of anything elsewhere.
  expect(file).not.toMatch(/<(script|link|img|iframe|object|embed|base|form)\b/i);
  expect(file).not.toMatch(/\s(src|srcset|action|data)=/i);
  expect(file).not.toMatch(/@import|url\(|https?:|\/\//i);
  // Every link goes to a part of the file itself.
  const links = [...file.matchAll(/href="([^"]*)"/g)].map(([, to]) => to!);
  expect(links).toEqual(["#shop", "#customers", "#refillers", "#bills"]);
  for (const link of links) expect(file).toContain(`id="${link.slice(1)}"`);
  // A browser that opens it is told to fetch and run nothing.
  expect(file).toMatch(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="default-src 'none'; style-src 'unsafe-inline'"/,
  );
});

test("nothing typed into the records is read as markup", async () => {
  const agency = await start();
  const { app, admin, staff, addVehicle, dispatch, receive, against, cancel, asLines, backup } =
    agency;
  // Text that would break out of a tag or an attribute, or end a part early.
  const hostile = (where: string) => `${where} <script>alert("x")</script></section> &amp; 'y'`;
  const addParty = async (type: string, name: string, notes: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/parties",
      headers: staff.headers,
      payload: { type, name, notes },
    });
    expect(response.statusCode).toBe(201);
    return response.json<{ id: string }>();
  };
  const customer = await addParty("customer", hostile("name"), hostile("note"));
  const refiller = await addParty("refiller", `"><img src=x onerror=alert(1)>`, "-->");
  const renamed = await app.inject({
    method: "PATCH",
    url: `/api/gases/${agency.gas("Argon").id}`,
    headers: admin.headers,
    payload: { name: "<b>Argon</b>" },
  });
  expect(renamed.statusCode).toBe(200);
  const vehicle = await addVehicle({ plate: "<i>MH</i>", label: "</td><td>" });
  const sent = await dispatch(customer.id, {
    number: "<u>1</u>",
    vehicleId: vehicle.id,
    notes: hostile("bill"),
    lines: asLines([{ gas: "Argon", quantity: 2 }]),
  });
  const returned = await receive(customer.id, [against(sent, "Argon", 1)], {
    slipNumber: "<s>",
  });
  await cancel(returned, { reason: "other", notes: hostile("cancelled") });
  await agency.send(refiller.id);

  const file = await backup();

  expect(file).not.toMatch(/<(script|img|b|i|u|s)[\s>]/i);
  // Four parts, none ended early.
  expect(file.match(/<\/section>/g)).toHaveLength(4);
  // Each is shown as it was typed.
  const customers = rowsOf(file, "customers");
  expect(customers).toEqual([[`${hostile("name")} ${hostile("note")}`, "<b>Argon</b> 2", "2"]]);
  expect(rowsOf(file, "refillers")[0]![0]).toBe(`"><img src=x onerror=alert(1)> -->`);
  expect(rowsOf(file, "shop").map(([name]) => name)).toContain("<b>Argon</b>");
  const bills = textOf(partOf(file, "bills"));
  for (const typedText of [
    "<u>1</u>",
    "Slip number: <s>",
    "Vehicle: <i>MH</i> (</td><td>)",
    hostile("bill"),
    hostile("cancelled"),
  ]) {
    expect(bills).toContain(typedText);
  }
});
