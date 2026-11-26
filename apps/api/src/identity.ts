import type { NewStaff } from "@gasflow/shared";
import { Refusal } from "./refusal";

/** A person as the identity provider knows them. */
export interface Identity {
  identityId: string;
  displayName: string;
  isAdmin: boolean;
}

/** An account someone can sign in with. */
export interface Account extends Identity {
  username: string | null;
  /** Where a code to reset a forgotten password goes, if anywhere. */
  recoveryEmail: string | null;
}

export type NewAccount = NewStaff;

/** Why an account cannot be as asked, in words for the admin who asked. */
export const ACCOUNT_PROBLEMS = {
  usernameTaken: "That username is already taken.",
  usernameLength: "Usernames must be 4 to 64 characters long.",
  usernameCharacters:
    "A username can use only letters, numbers, - and _, and cannot be all digits.",
  passwordTooShort: "Passwords must be at least 8 characters long.",
  passwordTooLong: "That password is too long. Choose a shorter one.",
  emailTaken: "Another account already uses that email address.",
  emailInvalid: "Enter a valid email address.",
} as const;

/** The provider turning down a username, password or email address. */
export class AccountRefusal extends Refusal {
  constructor(problems: string[]) {
    super(422, [...new Set(problems)].join(" "));
  }
}

/**
 * Everything the API asks of whoever looks after accounts and sign-in. Nothing
 * else talks to that service, so tests can replace it. Whatever it will not
 * accept in an account, it throws as an AccountRefusal.
 */
export interface IdentityProvider {
  /** The person a session token belongs to, or null if the token is not valid. */
  verifyToken(token: string): Promise<Identity | null>;
  /** Every account that someone can sign in with. */
  listAccounts(): Promise<Account[]>;
  /** The account with this id, or null if no one can sign in with it. */
  findAccount(identityId: string): Promise<Account | null>;
  createAccount(account: NewAccount): Promise<Account>;
  /**
   * Sets a new password and ends the person's sessions. A token already issued
   * goes on working until it expires, which is within about a minute.
   */
  resetPassword(identityId: string, newPassword: string): Promise<void>;
  /** Ends the account for good. Does nothing if it has already ended. */
  removeAccess(identityId: string): Promise<void>;
  /** Makes the account an admin's, with this as its one recovery email. */
  grantAdmin(identityId: string, recoveryEmail: string): Promise<void>;
  /** Takes away the admin role, and with it the recovery email: only admins have one. */
  revokeAdmin(identityId: string): Promise<void>;
}
