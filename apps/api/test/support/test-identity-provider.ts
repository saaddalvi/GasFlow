import { randomUUID } from "node:crypto";
import type { Identity, IdentityProvider, NewAccount } from "../../src/identity";

const TOKEN_PREFIX = "test-session:";

/** Keeps accounts in memory. A session token is just a label for one account. */
export class TestIdentityProvider implements IdentityProvider {
  private readonly accounts = new Map<string, Identity>();

  verifyToken(token: string): Promise<Identity | null> {
    const identity = token.startsWith(TOKEN_PREFIX)
      ? this.accounts.get(token.slice(TOKEN_PREFIX.length))
      : undefined;
    return Promise.resolve(identity ? { ...identity } : null);
  }

  createAccount({ displayName }: NewAccount): Promise<Identity> {
    const identity = { identityId: randomUUID(), displayName, isAdmin: false };
    this.accounts.set(identity.identityId, identity);
    return Promise.resolve({ ...identity });
  }

  resetPassword(identityId: string, _newPassword: string): Promise<void> {
    return this.accounts.has(identityId)
      ? Promise.resolve()
      : Promise.reject(new Error(`No account ${identityId}`));
  }

  removeAccess(identityId: string): Promise<void> {
    this.accounts.delete(identityId);
    return Promise.resolve();
  }

  /** The token a signed-in person's requests would carry. */
  sessionToken(identityId: string): string {
    return `${TOKEN_PREFIX}${identityId}`;
  }
}
