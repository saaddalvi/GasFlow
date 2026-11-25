/** A person as the identity provider knows them. */
export interface Identity {
  identityId: string;
  displayName: string;
  isAdmin: boolean;
}

export interface NewAccount {
  displayName: string;
  username: string;
  password: string;
}

/**
 * Everything the API asks of whoever looks after accounts and sign-in. Nothing
 * else talks to that service, so tests can replace it.
 */
export interface IdentityProvider {
  /** The person a session token belongs to, or null if the token is not valid. */
  verifyToken(token: string): Promise<Identity | null>;
  createAccount(account: NewAccount): Promise<Identity>;
  resetPassword(identityId: string, newPassword: string): Promise<void>;
  removeAccess(identityId: string): Promise<void>;
}
