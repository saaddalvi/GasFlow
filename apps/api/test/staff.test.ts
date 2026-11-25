import { staffListSchema, staffMemberSchema } from "@gasflow/shared";
import { expect, test } from "vitest";
import { startTestApp } from "./support/test-app";

const NEW_STAFF = {
  displayName: "Ravi Shah",
  username: "ravi",
  password: "cylinder-yard-42",
};

/** The app with an admin signed in. */
async function startAsAdmin() {
  const testApp = await startTestApp();
  const { app } = testApp;
  const admin = await testApp.signIn({ displayName: "Asha Patil", isAdmin: true });

  /** The Staff screen's list, as the admin sees it. */
  async function listStaff() {
    const response = await app.inject({ method: "GET", url: "/api/staff", headers: admin.headers });
    expect(response.statusCode).toBe(200);
    return staffListSchema.parse(response.json()).staff;
  }

  /** Adds a staff member through the API, as the Staff screen does. */
  async function addStaff(newStaff = NEW_STAFF) {
    const response = await app.inject({
      method: "POST",
      url: "/api/staff",
      headers: admin.headers,
      payload: newStaff,
    });
    expect(response.statusCode).toBe(201);
    return staffMemberSchema.parse(response.json());
  }

  const setPassword = (staffId: string, password: string, headers = admin.headers) =>
    app.inject({
      method: "PUT",
      url: `/api/staff/${staffId}/password`,
      headers,
      payload: { password },
    });

  const removeAccess = (staffId: string, headers = admin.headers) =>
    app.inject({ method: "DELETE", url: `/api/staff/${staffId}/access`, headers });

  /** The headers of someone who signs in with this username and password. */
  const signInAs = ({ username, password } = NEW_STAFF) => ({
    authorization: `Bearer ${testApp.identity.signInWith(username, password)}`,
  });

  return { ...testApp, admin, listStaff, addStaff, setPassword, removeAccess, signInAs };
}

test("an admin creates an account, and that person can then sign in", async () => {
  const { app, identity, admin, me } = await startAsAdmin();

  const response = await app.inject({
    method: "POST",
    url: "/api/staff",
    headers: admin.headers,
    payload: NEW_STAFF,
  });

  expect(response.statusCode).toBe(201);
  const created = staffMemberSchema.parse(response.json());
  expect(created).toMatchObject({
    displayName: "Ravi Shah",
    account: { username: "ravi", isAdmin: false, recoveryEmail: null },
  });
  const token = identity.signInWith("ravi", "cylinder-yard-42");
  expect(token).not.toBeNull();
  expect(await me({ authorization: `Bearer ${token}` })).toEqual({
    id: created.id,
    displayName: "Ravi Shah",
    isAdmin: false,
  });
});

test("staff are refused creating an account", async () => {
  const { app, identity, signIn } = await startTestApp();
  const { headers } = await signIn();

  const response = await app.inject({
    method: "POST",
    url: "/api/staff",
    headers,
    payload: NEW_STAFF,
  });

  expect(response.statusCode).toBe(403);
  expect(identity.signInWith("ravi", "cylinder-yard-42")).toBeNull();
});

test.each([
  ["a username that is taken", { username: "asha" }, "That username is already taken."],
  [
    "a username that is too short",
    { username: "ab" },
    "Usernames must be 4 to 64 characters long.",
  ],
  [
    "a username with other characters",
    { username: "ravi shah" },
    "A username can use only letters, numbers, - and _, and cannot be all digits.",
  ],
  [
    "a password under 8 characters",
    { password: "gas-123" },
    "Passwords must be at least 8 characters long.",
  ],
  [
    "a password found in a leak",
    { password: "password123" },
    "That password has appeared in a known leak. Choose a different one.",
  ],
  [
    "two things wrong at once",
    { username: "ab", password: "gas-123" },
    "Usernames must be 4 to 64 characters long. Passwords must be at least 8 characters long.",
  ],
])("an account with %s is refused with a clear message", async (_case, change, message) => {
  const { app, identity, admin, addStaff } = await startAsAdmin();
  await addStaff({ displayName: "Asha Joshi", username: "asha", password: "front-counter-7" });
  const payload = { ...NEW_STAFF, ...change };

  const response = await app.inject({
    method: "POST",
    url: "/api/staff",
    headers: admin.headers,
    payload,
  });

  expect(response.statusCode).toBe(422);
  expect(response.json()).toMatchObject({ message });
  expect(identity.signInWith(payload.username, payload.password)).toBeNull();
});

test.each([
  ["no name", { displayName: "   " }, "Enter the person's name."],
  ["no username", { username: "" }, "Enter a username."],
  ["no password", { password: undefined }, "Enter a password."],
])("an account with %s is refused", async (_case, change, message) => {
  const { app, admin } = await startAsAdmin();

  const response = await app.inject({
    method: "POST",
    url: "/api/staff",
    headers: admin.headers,
    payload: { ...NEW_STAFF, ...change },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
});

test("an admin sees everyone with an account, including people who have never signed in", async () => {
  const { identity, listStaff } = await startAsAdmin();
  await identity.createAccount(NEW_STAFF);

  const staff = await listStaff();

  expect(staff).toMatchObject([
    { displayName: "Asha Patil", account: { isAdmin: true } },
    { displayName: "Ravi Shah", account: { username: "ravi", isAdmin: false } },
  ]);
  // Their staff records last, so each keeps its id.
  expect(await listStaff()).toEqual(staff);
});

test("staff are refused the staff list", async () => {
  const { app, signIn } = await startTestApp();
  const { headers } = await signIn();

  const response = await app.inject({ method: "GET", url: "/api/staff", headers });

  expect(response.statusCode).toBe(403);
});

test("an admin sets a new password for a staff member", async () => {
  const { identity, addStaff, setPassword } = await startAsAdmin();
  const ravi = await addStaff();

  const response = await setPassword(ravi.id, "new-yard-key-9");

  expect(response.statusCode).toBe(204);
  expect(identity.signInWith("ravi", "new-yard-key-9")).not.toBeNull();
  expect(identity.signInWith("ravi", "cylinder-yard-42")).toBeNull();
});

test.each([
  ["under 8 characters", "gas-123", 422, "Passwords must be at least 8 characters long."],
  [
    "found in a leak",
    "password123",
    422,
    "That password has appeared in a known leak. Choose a different one.",
  ],
  ["empty", "", 400, "Enter a password."],
])("a new password %s is refused", async (_case, password, status, message) => {
  const { identity, addStaff, setPassword } = await startAsAdmin();
  const ravi = await addStaff();

  const response = await setPassword(ravi.id, password);

  expect(response.statusCode).toBe(status);
  expect(response.json()).toMatchObject({ message });
  expect(identity.signInWith("ravi", "cylinder-yard-42")).not.toBeNull();
});

test("staff are refused setting a password", async () => {
  const { identity, signIn, addStaff, setPassword } = await startAsAdmin();
  const ravi = await addStaff();
  const { headers } = await signIn({ displayName: "Meena Rao" });

  const response = await setPassword(ravi.id, "new-yard-key-9", headers);

  expect(response.statusCode).toBe(403);
  expect(identity.signInWith("ravi", "cylinder-yard-42")).not.toBeNull();
});

test.each(["0b8f2c6e-1f4a-4d0b-9c55-999999999999", "not-an-id"])(
  "a password for %s, who is not a staff member, is refused",
  async (staffId) => {
    const { setPassword } = await startAsAdmin();

    const response = await setPassword(staffId, "new-yard-key-9");

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "There is no such staff member." });
  },
);

test("an admin removes a staff member's access, and their record and name are kept", async () => {
  const { app, identity, listStaff, addStaff, removeAccess, signInAs, me } = await startAsAdmin();
  const ravi = await addStaff();
  const raviHeaders = signInAs();
  await me(raviHeaders);

  const response = await removeAccess(ravi.id);

  expect(response.statusCode).toBe(204);
  // The session they already had stops working, and so does signing in.
  const after = await app.inject({ method: "GET", url: "/api/gases", headers: raviHeaders });
  expect(after.statusCode).toBe(401);
  expect(identity.signInWith("ravi", "cylinder-yard-42")).toBeNull();
  expect(await listStaff()).toMatchObject([
    { displayName: "Asha Patil" },
    { id: ravi.id, displayName: "Ravi Shah", account: null },
  ]);
});

test("people without access are listed after everyone who has it", async () => {
  const { listStaff, addStaff, removeAccess } = await startAsAdmin();
  const bina = await addStaff({ ...NEW_STAFF, displayName: "Bina Das", username: "bina" });
  await addStaff();

  await removeAccess(bina.id);

  expect((await listStaff()).map((member) => member.displayName)).toEqual([
    "Asha Patil",
    "Ravi Shah",
    "Bina Das",
  ]);
});

test("removing access a second time changes nothing", async () => {
  const { addStaff, removeAccess } = await startAsAdmin();
  const ravi = await addStaff();

  await removeAccess(ravi.id);
  const again = await removeAccess(ravi.id);

  expect(again.statusCode).toBe(204);
});

test("someone whose access is removed cannot be given a new password", async () => {
  const { identity, addStaff, removeAccess, setPassword } = await startAsAdmin();
  const ravi = await addStaff();
  await removeAccess(ravi.id);

  const response = await setPassword(ravi.id, "new-yard-key-9");

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ message: "This person's access has been removed." });
  expect(identity.signInWith("ravi", "new-yard-key-9")).toBeNull();
});

test("an admin cannot remove their own access", async () => {
  const { admin, me, removeAccess } = await startAsAdmin();
  const { id } = await me(admin.headers);

  const response = await removeAccess(id.toUpperCase());

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "You cannot remove your own access. Ask another admin to do it.",
  });
  expect(await me(admin.headers)).toMatchObject({ id, isAdmin: true });
});

test("staff are refused removing access", async () => {
  const { identity, signIn, addStaff, removeAccess } = await startAsAdmin();
  const ravi = await addStaff();
  const { headers } = await signIn({ displayName: "Meena Rao" });

  const response = await removeAccess(ravi.id, headers);

  expect(response.statusCode).toBe(403);
  expect(identity.signInWith("ravi", "cylinder-yard-42")).not.toBeNull();
});

/** A staff member with their own signed-in session, added through the API. */
async function startWithRavi() {
  const testApp = await startAsAdmin();
  const { app, admin, addStaff, signInAs } = testApp;
  const ravi = await addStaff();
  const raviHeaders = signInAs();

  const makeAdmin = (payload: object, staffId = ravi.id, headers = admin.headers) =>
    app.inject({ method: "PUT", url: `/api/staff/${staffId}/admin`, headers, payload });
  const removeAdmin = (staffId = ravi.id, headers = admin.headers) =>
    app.inject({ method: "DELETE", url: `/api/staff/${staffId}/admin`, headers });
  /** Whether Ravi may do what only an admin may. */
  const raviIsAllowed = async () => {
    const response = await app.inject({ method: "GET", url: "/api/staff", headers: raviHeaders });
    return response.statusCode === 200;
  };

  return { ...testApp, ravi, raviHeaders, makeAdmin, removeAdmin, raviIsAllowed };
}

test("an admin makes a staff member an admin, with a recovery email", async () => {
  const { ravi, makeAdmin, raviIsAllowed, listStaff } = await startWithRavi();

  const response = await makeAdmin({ recoveryEmail: " ravi@example.com " });

  expect(response.statusCode).toBe(204);
  expect(await raviIsAllowed()).toBe(true);
  expect(await listStaff()).toContainEqual({
    ...ravi,
    account: { username: "ravi", isAdmin: true, recoveryEmail: "ravi@example.com" },
  });
});

test.each([
  ["no recovery email", {}, "Enter a recovery email."],
  ["a blank recovery email", { recoveryEmail: "  " }, "Enter a recovery email."],
  [
    "something that is not an email address",
    { recoveryEmail: "ravi" },
    "Enter a valid email address.",
  ],
])("the admin role is not given with %s", async (_case, payload, message) => {
  const { makeAdmin, raviIsAllowed } = await startWithRavi();

  const response = await makeAdmin(payload);

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ message });
  expect(await raviIsAllowed()).toBe(false);
});

test("the admin role is not given with another account's email", async () => {
  const { admin, me, makeAdmin, raviIsAllowed } = await startWithRavi();
  const asha = await me(admin.headers);
  await makeAdmin({ recoveryEmail: "asha@example.com" }, asha.id);

  const response = await makeAdmin({ recoveryEmail: "asha@example.com" });

  expect(response.statusCode).toBe(422);
  expect(response.json()).toMatchObject({
    message: "Another account already uses that email address.",
  });
  expect(await raviIsAllowed()).toBe(false);
});

test("an admin changes their own recovery email", async () => {
  const { admin, me, makeAdmin, listStaff } = await startWithRavi();
  const asha = await me(admin.headers);
  await makeAdmin({ recoveryEmail: "old@example.com" }, asha.id);

  const response = await makeAdmin({ recoveryEmail: "new@example.com" }, asha.id);

  expect(response.statusCode).toBe(204);
  const changed = (await listStaff()).find((member) => member.id === asha.id);
  expect(changed?.account).toMatchObject({ isAdmin: true, recoveryEmail: "new@example.com" });
});

test("an admin removes the admin role from a staff member", async () => {
  const { app, raviHeaders, makeAdmin, removeAdmin, raviIsAllowed } = await startWithRavi();
  await makeAdmin({ recoveryEmail: "ravi@example.com" });

  const response = await removeAdmin();

  expect(response.statusCode).toBe(204);
  expect(await raviIsAllowed()).toBe(false);
  // They are still staff.
  const gases = await app.inject({ method: "GET", url: "/api/gases", headers: raviHeaders });
  expect(gases.statusCode).toBe(200);
});

test("removing the admin role takes the recovery email off the account", async () => {
  const { ravi, admin, me, makeAdmin, removeAdmin, listStaff } = await startWithRavi();
  await makeAdmin({ recoveryEmail: "ravi@example.com" });

  await removeAdmin();

  expect(await listStaff()).toContainEqual({
    ...ravi,
    account: { username: "ravi", isAdmin: false, recoveryEmail: null },
  });
  // Nothing holds the address any more, so another account can use it.
  const asha = await me(admin.headers);
  const reused = await makeAdmin({ recoveryEmail: "ravi@example.com" }, asha.id);
  expect(reused.statusCode).toBe(204);
});

test("an admin cannot remove their own admin role", async () => {
  const { admin, me, removeAdmin } = await startWithRavi();
  const asha = await me(admin.headers);

  const response = await removeAdmin(asha.id);

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({
    message: "You cannot remove your own admin role. Ask another admin to do it.",
  });
  expect(await me(admin.headers)).toMatchObject({ isAdmin: true });
});

test("staff are refused making themselves an admin", async () => {
  const { ravi, raviHeaders, makeAdmin, raviIsAllowed } = await startWithRavi();

  const response = await makeAdmin({ recoveryEmail: "ravi@example.com" }, ravi.id, raviHeaders);

  expect(response.statusCode).toBe(403);
  expect(await raviIsAllowed()).toBe(false);
});

test("staff are refused removing an admin's role", async () => {
  const { admin, me, raviHeaders, removeAdmin } = await startWithRavi();
  const asha = await me(admin.headers);

  const response = await removeAdmin(asha.id, raviHeaders);

  expect(response.statusCode).toBe(403);
  expect(await me(admin.headers)).toMatchObject({ isAdmin: true });
});

test("someone whose access is removed cannot be made an admin", async () => {
  const { ravi, removeAccess, makeAdmin } = await startWithRavi();
  await removeAccess(ravi.id);

  const response = await makeAdmin({ recoveryEmail: "ravi@example.com" });

  expect(response.statusCode).toBe(409);
});
