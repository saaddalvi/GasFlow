import { createClerkClient, verifyToken, type User } from "@clerk/backend";
import {
  isClerkAPIResponseError,
  type ClerkAPIResponseError,
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";
import {
  ACCOUNT_PROBLEMS,
  AccountRefusal,
  type Account,
  type Identity,
  type IdentityProvider,
} from "./identity";

type ClerkError = ClerkAPIResponseError["errors"][number];

export interface ClerkSettings {
  secretKey: string;
  /** Web app origins whose tokens are accepted. Any origin when not set. */
  authorizedParties?: string[];
}

// Failures that say nothing about the token: Clerk could not be reached, or the
// API is set up wrongly. These must not look like a signed-out request.
const OUR_FAILURES = new Set<string>([
  TokenVerificationErrorReason.InvalidSecretKey,
  TokenVerificationErrorReason.LocalJWKMissing,
  TokenVerificationErrorReason.RemoteJWKFailedToLoad,
  TokenVerificationErrorReason.RemoteJWKInvalid,
  TokenVerificationErrorReason.RemoteJWKMissing,
  TokenVerificationErrorReason.JWKFailedToResolve,
]);

// The most accounts Clerk gives in one answer.
const PAGE_SIZE = 500;

/** Staff accounts and sign-in, as held by Clerk. */
export function createClerkIdentityProvider({
  secretKey,
  authorizedParties,
}: ClerkSettings): IdentityProvider {
  const clerk = createClerkClient({ secretKey });

  /** The account a session token was issued to, or null if the token is no good. */
  async function accountIdFrom(token: string): Promise<string | null> {
    if (!looksLikeToken(token)) {
      return null;
    }
    try {
      const claims = await verifyToken(token, { secretKey, authorizedParties });
      // Only a finished sign-in counts: it has a session, with nothing left to do.
      return claims.sid && claims.sts !== "pending" ? claims.sub : null;
    } catch (error) {
      if (error instanceof TokenVerificationError && !OUR_FAILURES.has(error.reason)) {
        return null;
      }
      throw error;
    }
  }

  // Asked on every request, so that a changed name or role counts at once.
  async function findUser(userId: string): Promise<User | null> {
    try {
      return await clerk.users.getUser(userId);
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  /** Leaves the account with this one email address, verified and primary. */
  async function setOnlyEmail(userId: string, address: string): Promise<void> {
    const { emailAddresses } = await clerk.users.getUser(userId);
    const wanted = address.toLowerCase();
    const existing = emailAddresses.find((email) => email.emailAddress.toLowerCase() === wanted);
    // Verified without a code, so that an admin can enter it for someone else.
    const asRecovery = { verified: true, primary: true };
    const kept = existing
      ? await clerk.emailAddresses.updateEmailAddress(existing.id, asRecovery)
      : await clerk.emailAddresses.createEmailAddress({
          userId,
          emailAddress: address,
          ...asRecovery,
        });
    // An old address, perhaps a mistyped one, must not go on receiving reset codes.
    await deleteEmails(emailAddresses.filter((email) => email.id !== kept.id));
  }

  async function deleteEmails(emails: User["emailAddresses"]): Promise<void> {
    for (const email of emails) {
      await clerk.emailAddresses.deleteEmailAddress(email.id);
    }
  }

  return {
    async verifyToken(token) {
      const userId = await accountIdFrom(token);
      const user = userId ? await findUser(userId) : null;
      return user && !user.banned ? toIdentity(user) : null;
    },
    async listAccounts() {
      const users: User[] = [];
      let page: User[];
      do {
        const query = { limit: PAGE_SIZE, offset: users.length };
        page = (await clerk.users.getUserList(query)).data;
        users.push(...page);
      } while (page.length === PAGE_SIZE);
      return users.filter((user) => !user.banned).map(toAccount);
    },
    async findAccount(userId) {
      const user = await findUser(userId);
      return user && !user.banned ? toAccount(user) : null;
    },
    async createAccount({ displayName, username, password }) {
      // The whole name goes in one field, so that it reads back as it was typed.
      const user = await changeAccount(() =>
        clerk.users.createUser({ firstName: displayName, username, password }),
      );
      return toAccount(user);
    },
    async resetPassword(userId, password) {
      await changeAccount(() =>
        clerk.users.updateUser(userId, { password, signOutOfOtherSessions: true }),
      );
    },
    async removeAccess(userId) {
      await changeAccount(async () => {
        try {
          await clerk.users.deleteUser(userId);
        } catch (error) {
          if (!isNotFound(error)) {
            throw error;
          }
        }
      });
    },
    async grantAdmin(userId, recoveryEmail) {
      await changeAccount(async () => {
        // The email comes first, so that there is never an admin without one.
        await setOnlyEmail(userId, recoveryEmail);
        await clerk.users.updateUserMetadata(userId, { publicMetadata: { role: "admin" } });
      });
    },
    async revokeAdmin(userId) {
      await changeAccount(async () => {
        // The role goes first, so that a failure leaves nobody with more than they should
        // have. Clerk removes a metadata key that is set to null.
        const user = await clerk.users.updateUserMetadata(userId, {
          publicMetadata: { role: null },
        });
        await deleteEmails(user.emailAddresses);
      });
    },
  };
}

/**
 * Makes a change to an account. What Clerk will not accept comes back as a
 * refusal, and any other failure as an error of our own.
 */
async function changeAccount<T>(change: () => Promise<T>): Promise<T> {
  try {
    return await change();
  } catch (error) {
    if (!isClerkAPIResponseError(error)) {
      throw error;
    }
    // Clerk names what is wrong with something typed in a "form_" or "_exists" code.
    const problems = error.errors.filter(({ code }) => /^form_|_exists$/.test(code));
    if (problems.length > 0 && (error.status === 422 || error.status === 400)) {
      throw new AccountRefusal(problems.map(inOurWords));
    }
    // Not passed on as it is: Clerk's status, such as 401, would be taken for ours.
    throw new Error(`Clerk answered ${error.status} to a change to an account.`, { cause: error });
  }
}

/** Our message for a problem Clerk reports, or Clerk's own for one we do not expect. */
function inOurWords({ code, message, longMessage, meta }: ClerkError): string {
  // Clerk leaves what `meta` holds untyped.
  const { paramName } = (meta ?? {}) as { paramName?: string };
  const aboutEmail = paramName?.includes("email");
  switch (code) {
    case "form_identifier_exists":
      return aboutEmail ? ACCOUNT_PROBLEMS.emailTaken : ACCOUNT_PROBLEMS.usernameTaken;
    case "username_exists":
      return ACCOUNT_PROBLEMS.usernameTaken;
    case "email_address_exists":
      return ACCOUNT_PROBLEMS.emailTaken;
    case "form_username_invalid_length":
      return ACCOUNT_PROBLEMS.usernameLength;
    case "form_username_invalid_character":
    case "form_username_needs_non_number_char":
      return ACCOUNT_PROBLEMS.usernameCharacters;
    case "form_password_length_too_short":
      return ACCOUNT_PROBLEMS.passwordTooShort;
    case "form_password_length_too_long":
    case "form_password_size_in_bytes_exceeded":
      return ACCOUNT_PROBLEMS.passwordTooLong;
    case "form_param_format_invalid":
      if (aboutEmail) {
        return ACCOUNT_PROBLEMS.emailInvalid;
      }
  }
  return longMessage ?? message;
}

/**
 * Whether the header and claims are both JSON objects. Clerk's verifier crashes,
 * where it should refuse, on a made-up token that has `null` for either.
 */
function looksLikeToken(token: string): boolean {
  return token
    .split(".")
    .slice(0, 2)
    .every((part) => {
      try {
        const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString());
        return typeof value === "object" && value !== null;
      } catch {
        return false;
      }
    });
}

function toIdentity(user: User): Identity {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return {
    identityId: user.id,
    displayName: name || user.username || user.id,
    isAdmin: user.publicMetadata.role === "admin",
  };
}

function toAccount(user: User): Account {
  const verified = user.emailAddresses.filter((email) => email.verification?.status === "verified");
  const recovery = verified.find((email) => email.id === user.primaryEmailAddressId) ?? verified[0];
  return {
    ...toIdentity(user),
    username: user.username,
    recoveryEmail: recovery?.emailAddress ?? null,
  };
}

function isNotFound(error: unknown): boolean {
  return isClerkAPIResponseError(error) && error.status === 404;
}
