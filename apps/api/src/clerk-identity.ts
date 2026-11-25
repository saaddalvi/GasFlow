import { createClerkClient, verifyToken, type User } from "@clerk/backend";
import {
  isClerkAPIResponseError,
  TokenVerificationError,
  TokenVerificationErrorReason,
} from "@clerk/backend/errors";
import type { Identity, IdentityProvider } from "./identity";

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
      if (isClerkAPIResponseError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  return {
    async verifyToken(token) {
      const userId = await accountIdFrom(token);
      const user = userId ? await findUser(userId) : null;
      return user && !user.banned ? toIdentity(user) : null;
    },
    createAccount: notYetSupported,
    resetPassword: notYetSupported,
    removeAccess: notYetSupported,
  };
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

function notYetSupported(): Promise<never> {
  return Promise.reject(new Error("The app cannot change staff accounts yet."));
}
