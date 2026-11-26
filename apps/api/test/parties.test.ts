import { partyListSchema, partySchema, shopSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

const CUSTOMER = {
  type: "customer",
  name: "City Hospital",
  abbreviation: "CH",
  mobile: "98200 12345",
  contactPerson: "Meena Rao",
  address: "12 Station Road\nPune 411001",
  notes: "Collect empties on Fridays.",
};

/** The app with a staff member signed in, who is not an admin. */
async function startAsStaff() {
  const testApp = await startTestApp();
  const { app } = testApp;
  const { headers } = await testApp.signIn();

  const postParty = (payload: object) =>
    app.inject({ method: "POST", url: "/api/parties", headers, payload });

  const getParty = (partyId: string) =>
    app.inject({ method: "GET", url: `/api/parties/${partyId}`, headers });

  const changeParty = (partyId: string, payload: object) =>
    app.inject({ method: "PATCH", url: `/api/parties/${partyId}`, headers, payload });

  /** Adds a party through the API, as the Add party screen does. */
  async function addParty(payload: object = CUSTOMER) {
    const response = await postParty(payload);
    expect(response.statusCode).toBe(201);
    return partySchema.parse(response.json());
  }

  /** The party list for a query such as "type=customer". */
  async function listParties(query = "") {
    const response = await app.inject({ method: "GET", url: `/api/parties?${query}`, headers });
    expect(response.statusCode).toBe(200);
    return partyListSchema.parse(response.json());
  }

  const listNames = async (query = "") =>
    (await listParties(query)).parties.map((party) => party.name);

  /** Adds a customer for each name. */
  async function addCustomers(...names: string[]) {
    for (const name of names) {
      await addParty({ type: "customer", name });
    }
  }

  /** The shop's id, which no screen offers but a request could name. */
  async function shop() {
    const response = await app.inject({ method: "GET", url: "/api/shop", headers });
    return shopSchema.parse(response.json());
  }

  return {
    ...testApp,
    headers,
    postParty,
    getParty,
    changeParty,
    addParty,
    addCustomers,
    listParties,
    listNames,
    shop,
  };
}

test.each(["customer", "refiller", "supplier"])(
  "staff add a %s with their contact details and view them",
  async (type) => {
    const { postParty, getParty } = await startAsStaff();

    const response = await postParty({ ...CUSTOMER, type });

    expect(response.statusCode).toBe(201);
    const added = partySchema.parse(response.json());
    expect(added).toEqual({ ...CUSTOMER, type, id: added.id, active: true });
    expect((await getParty(added.id)).json()).toEqual(added);
  },
);

test.each([
  ["Sharma Gas Agency", "SGA"],
  ["Apollo", "APO"],
  ["  st. Mary's   hospital ", "SMH"],
  ["Om", "OM"],
  ["Shree Ganesh Industrial Gas and Welding Supplies", "SGIGA"],
  ["अपोलो", "अपो"],
  ["***", "***"],
])("a party named %s gets the abbreviation %s when none is given", async (name, abbreviation) => {
  const { addParty } = await startAsStaff();

  const added = await addParty({ type: "customer", name });

  expect(added.abbreviation).toBe(abbreviation);
});

test("a party needs only a type and a name, and starts active", async () => {
  const { addParty } = await startAsStaff();

  const added = await addParty({
    type: "refiller",
    name: "  Deccan Gases ",
    abbreviation: "  ",
    mobile: "",
    contactPerson: null,
  });

  expect(added).toEqual({
    id: added.id,
    type: "refiller",
    name: "Deccan Gases",
    abbreviation: "DG",
    mobile: null,
    contactPerson: null,
    address: null,
    notes: null,
    active: true,
  });
});

const BAD_TYPE = "Choose customer, refiller or supplier.";

test.each([
  ["no name", { name: undefined }, "Enter the party's name."],
  ["a blank name", { name: "   " }, "Enter the party's name."],
  ["a name too long", { name: "a".repeat(101) }, "Use a name of at most 100 characters."],
  [
    "an abbreviation too long",
    { abbreviation: "ABCDEFGHIJK" },
    "Use an abbreviation of at most 10 characters.",
  ],
  ["no type", { type: undefined }, BAD_TYPE],
  ["the type shop", { type: "shop" }, BAD_TYPE],
  ["the type warehouse", { type: "warehouse" }, BAD_TYPE],
])("a party with %s is refused", async (_case, change, message) => {
  const { postParty } = await startAsStaff();

  const response = await postParty({ ...CUSTOMER, ...change });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
});

test("staff change a party's details", async () => {
  const { addParty, changeParty, getParty } = await startAsStaff();
  const added = await addParty();
  const changes = {
    name: "City Care Hospital",
    abbreviation: "CCH",
    mobile: "99300 55555",
    contactPerson: "Ravi Shah",
    address: "4 Hill Road",
    notes: "Rings before collection.",
  };

  const response = await changeParty(added.id, changes);

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ ...added, ...changes });
  expect((await getParty(added.id)).json()).toEqual(response.json());
});

test("a change leaves alone whatever it does not mention", async () => {
  const { addParty, changeParty } = await startAsStaff();
  const added = await addParty();

  const response = await changeParty(added.id, { mobile: "99300 55555" });

  expect(response.json()).toEqual({ ...added, mobile: "99300 55555" });
});

test("a field made blank is emptied", async () => {
  const { addParty, changeParty } = await startAsStaff();
  const added = await addParty();

  const response = await changeParty(added.id, { mobile: " ", notes: null });

  expect(response.json()).toEqual({ ...added, mobile: null, notes: null });
});

test.each([
  ["with a new name", { name: "Ruby Clinic", abbreviation: "" }, "RC"],
  ["alone", { abbreviation: null }, "CH"],
])("an abbreviation made blank %s is made from the name", async (_case, changes, abbreviation) => {
  const { addParty, changeParty } = await startAsStaff();
  const added = await addParty({ ...CUSTOMER, abbreviation: "OLD" });

  const response = await changeParty(added.id, changes);

  expect(response.json()).toMatchObject({ abbreviation });
});

test("a party's type stays as it was added", async () => {
  const { addParty, changeParty, getParty } = await startAsStaff();
  const added = await addParty();

  await changeParty(added.id, { type: "refiller" });

  expect((await getParty(added.id)).json()).toEqual(added);
});

test("a change that blanks the name is refused", async () => {
  const { addParty, changeParty, getParty } = await startAsStaff();
  const added = await addParty();

  const response = await changeParty(added.id, { name: " ", mobile: "99300 55555" });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Enter the party's name." });
  expect((await getParty(added.id)).json()).toEqual(added);
});

test.each(["0b8f2c6e-1f4a-4d0b-9c55-999999999999", "not-an-id"])(
  "%s, which is no party, cannot be viewed or changed",
  async (partyId) => {
    const { getParty, changeParty } = await startAsStaff();

    const viewed = await getParty(partyId);
    const changed = await changeParty(partyId, { name: "Ruby Clinic" });

    for (const response of [viewed, changed]) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ message: "There is no such party." });
    }
  },
);

test.each([
  ["deactivated", { active: false }],
  ["renamed", { name: "Another shop" }],
])("the shop cannot be %s", async (_case, changes) => {
  const { changeParty, shop } = await startAsStaff();
  const before = await shop();

  const response = await changeParty(before.id, changes);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "The shop cannot be changed." });
  expect(await shop()).toEqual(before);
});

test("the shop cannot be deleted", async () => {
  const { app, headers, shop } = await startAsStaff();
  const before = await shop();

  const response = await app.inject({
    method: "DELETE",
    url: `/api/parties/${before.id}`,
    headers,
  });

  expect(response.statusCode).toBe(404);
  expect(await shop()).toEqual(before);
});

test("the party list is by name, whatever the type or capitals, without the shop", async () => {
  const { addParty, listParties } = await startAsStaff();
  const refiller = await addParty({ type: "refiller", name: "deccan Gases" });
  const customer = await addParty({ type: "customer", name: "City Hospital" });
  const supplier = await addParty({ type: "supplier", name: "Everest Cylinders" });

  const list = await listParties();

  expect(list).toEqual({
    parties: [customer, refiller, supplier],
    total: 3,
    page: 1,
    pageSize: 50,
  });
});

test.each([
  ["part of a name", "search=hosp", ["City Hospital", "Hospira"]],
  ["different capitals", "search=CITY", ["City Hospital", "Intercity Welders"]],
  ["spaces around it", "search=%20city%20hospital%20", ["City Hospital"]],
  ["a percent sign, which is only itself", "search=%25", ["100% Oxygen"]],
  ["an underscore, which is only itself", "search=_", []],
  ["a type", "type=refiller", ["Hospira"]],
  ["a name and a type", "search=city&type=customer", ["City Hospital", "Intercity Welders"]],
  [
    "blanks, which ask for everyone",
    "search=&type=",
    ["100% Oxygen", "City Hospital", "Hospira", "Intercity Welders"],
  ],
])("the party list can be narrowed by %s", async (_case, query, names) => {
  const { addParty, addCustomers, listNames } = await startAsStaff();
  await addCustomers("City Hospital", "Intercity Welders", "100% Oxygen");
  await addParty({ type: "refiller", name: "Hospira" });

  expect(await listNames(query)).toEqual(names);
});

test("the party list cannot be narrowed to the shop", async () => {
  const { app, headers } = await startAsStaff();

  const response = await app.inject({ method: "GET", url: "/api/parties?type=shop", headers });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: BAD_TYPE });
});

test("a deactivated party leaves the list, and is shown when inactive ones are asked for", async () => {
  const { addCustomers, addParty, changeParty, listNames, listParties } = await startAsStaff();
  await addCustomers("City Hospital");
  const ruby = await addParty({ type: "customer", name: "Ruby Clinic" });

  const response = await changeParty(ruby.id, { active: false });

  expect(response.statusCode).toBe(200);
  // What pickers ask for.
  expect(await listNames("type=customer")).toEqual(["City Hospital"]);
  expect(await listNames("search=ruby")).toEqual([]);
  expect((await listParties("inactive=true")).parties).toMatchObject([
    { name: "City Hospital", active: true },
    { name: "Ruby Clinic", active: false },
  ]);
});

test("a party made active again returns to the list", async () => {
  const { addParty, changeParty, listNames } = await startAsStaff();
  const ruby = await addParty({ type: "customer", name: "Ruby Clinic", active: false });
  expect(await listNames()).toEqual([]);

  await changeParty(ruby.id, { active: true });

  expect(await listNames()).toEqual(["Ruby Clinic"]);
});

test("a long party list comes a page at a time", async () => {
  const { addCustomers, listParties } = await startAsStaff();
  const names = Array.from({ length: 51 }, (_, i) => `Customer ${String(i + 1).padStart(2, "0")}`);
  await addCustomers(...names);

  const first = await listParties();
  const second = await listParties("page=2");
  const beyond = await listParties("page=3");

  expect(first.parties.map((party) => party.name)).toEqual(names.slice(0, 50));
  expect(second.parties.map((party) => party.name)).toEqual(["Customer 51"]);
  expect([first.total, second.total, beyond.total]).toEqual([51, 51, 51]);
  expect(second.page).toBe(2);
  expect(beyond.parties).toEqual([]);
});

test.each(["page=0", "page=two", "page=1.5"])(
  "a party list asked for %s is refused",
  async (query) => {
    const { app, headers } = await startAsStaff();

    const response = await app.inject({ method: "GET", url: `/api/parties?${query}`, headers });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ message: "There is no such page." });
  },
);

test("an admin can add and change a party too", async () => {
  const { app, signIn } = await startTestApp();
  const { headers } = await signIn({ isAdmin: true });

  const added = await app.inject({
    method: "POST",
    url: "/api/parties",
    headers,
    payload: CUSTOMER,
  });
  const changed = await app.inject({
    method: "PATCH",
    url: `/api/parties/${partySchema.parse(added.json()).id}`,
    headers,
    payload: { active: false },
  });

  expect(changed.statusCode).toBe(200);
  expect(changed.json()).toMatchObject({ name: "City Hospital", active: false });
});

test.each([
  ["a name", { name: "City\u0000Hospital" }],
  ["notes", { notes: "Fridays\u0000" }],
])("a party with an unusable character in %s is refused", async (_case, change) => {
  const { postParty, listNames } = await startAsStaff();

  const response = await postParty({ ...CUSTOMER, ...change });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Remove the characters that cannot be saved." });
  expect(await listNames()).toEqual([]);
});

test("a party with something other than text for a detail is refused in plain words", async () => {
  const { postParty } = await startAsStaff();

  const response = await postParty({ ...CUSTOMER, mobile: 9820012345 });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message: "Enter text, or leave it blank." });
});

test.each([
  ["for two names at once", "search=city&search=ruby", "Search for one name at a time."],
  ["for an unusable character", "search=%00", "Remove the characters that cannot be saved."],
])("a search %s is refused", async (_case, query, message) => {
  const { app, headers } = await startAsStaff();

  const response = await app.inject({ method: "GET", url: `/api/parties?${query}`, headers });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
});
