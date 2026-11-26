"use server";

import { sendChange, type Outcome } from "@/lib/api";

// What the Staff screen asks for. The API decides whether the person asking is
// allowed, and checks every value.

export async function addStaff(form: FormData): Promise<Outcome> {
  return sendChange("POST", "/api/staff", {
    displayName: form.get("displayName"),
    username: form.get("username"),
    password: form.get("password"),
  });
}

export async function setPassword(staffId: string, form: FormData): Promise<Outcome> {
  return sendChange("PUT", staffPath(staffId, "password"), { password: form.get("password") });
}

export async function makeAdmin(staffId: string, form: FormData): Promise<Outcome> {
  return sendChange("PUT", staffPath(staffId, "admin"), {
    recoveryEmail: form.get("recoveryEmail"),
  });
}

export async function removeAdminRole(staffId: string): Promise<Outcome> {
  return sendChange("DELETE", staffPath(staffId, "admin"));
}

export async function removeAccess(staffId: string): Promise<Outcome> {
  return sendChange("DELETE", staffPath(staffId, "access"));
}

function staffPath(staffId: string, what: string): string {
  return `/api/staff/${encodeURIComponent(staffId)}/${what}`;
}
