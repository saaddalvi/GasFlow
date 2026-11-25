import { z } from "zod";

/** A staff member as the API knows them. */
export const staffSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  isAdmin: z.boolean(),
});

export type Staff = z.infer<typeof staffSchema>;

/** A staff member as the Staff screen shows them. */
export const staffMemberSchema = staffSchema.pick({ id: true, displayName: true }).extend({
  /** How they get in, or null once their access has been removed. */
  account: z
    .object({
      username: z.string().nullable(),
      isAdmin: z.boolean(),
      /** Where a code to reset a forgotten admin password goes. */
      recoveryEmail: z.string().nullable(),
    })
    .nullable(),
});

export type StaffMember = z.infer<typeof staffMemberSchema>;

export const staffListSchema = z.object({
  staff: z.array(staffMemberSchema),
});

export type StaffList = z.infer<typeof staffListSchema>;

// Whoever looks after accounts decides which usernames and passwords are good
// enough, so these ask only that something was typed.
const password = z.string("Enter a password.").min(1, "Enter a password.");

export const newStaffSchema = z.object({
  displayName: z
    .string("Enter the person's name.")
    .trim()
    .min(1, "Enter the person's name.")
    .max(100, "Use a name of at most 100 characters."),
  username: z.string("Enter a username.").trim().min(1, "Enter a username."),
  password,
});

export type NewStaff = z.infer<typeof newStaffSchema>;

export const newPasswordSchema = z.object({ password });

/** What it takes to give someone the admin role, or to change an admin's recovery email. */
export const adminRoleSchema = z.object({
  recoveryEmail: z
    .string("Enter a recovery email.")
    .trim()
    .min(1, "Enter a recovery email.")
    .pipe(z.email("Enter a valid email address.")),
});
