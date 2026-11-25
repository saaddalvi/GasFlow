import { randomUUID } from "node:crypto";
import {
  ACCOUNT_PROBLEMS,
  AccountRefusal,
  type Account,
  type Identity,
  type IdentityProvider,
  type NewAccount,
} from "../../src/identity";

const TOKEN_PREFIX = "test-session:";

/** Passwords the stand-in treats as found in a known leak. */
const LEAKED_PASSWORDS = new Set(["password123"]);

type StoredAccount = Account & { username: string; password: string };

/**
 * Keeps accounts in memory, and turns down what the real provider would. A
 * session token is just a label for one account.
 */
export class TestIdentityProvider implements IdentityProvider {
  private readonly accounts = new Map<string, StoredAccount>();

  verifyToken(token: string): Promise<Identity | null> {
    const account = token.startsWith(TOKEN_PREFIX)
      ? this.accounts.get(token.slice(TOKEN_PREFIX.length))
      : undefined;
    return Promise.resolve(account ? toIdentity(account) : null);
  }

  listAccounts(): Promise<Account[]> {
    return Promise.resolve([...this.accounts.values()].map(toAccount));
  }

  findAccount(identityId: string): Promise<Account | null> {
    const account = this.accounts.get(identityId);
    return Promise.resolve(account ? toAccount(account) : null);
  }

  createAccount({ displayName, username, password }: NewAccount): Promise<Account> {
    const problems = [...this.usernameProblems(username), ...passwordProblems(password)];
    if (problems.length > 0) {
      return Promise.reject(new AccountRefusal(problems));
    }
    const account = {
      identityId: randomUUID(),
      displayName,
      username,
      password,
      isAdmin: false,
      recoveryEmail: null,
    };
    this.accounts.set(account.identityId, account);
    return Promise.resolve(toAccount(account));
  }

  resetPassword(identityId: string, newPassword: string): Promise<void> {
    const problems = passwordProblems(newPassword);
    if (problems.length > 0) {
      return Promise.reject(new AccountRefusal(problems));
    }
    this.account(identityId).password = newPassword;
    return Promise.resolve();
  }

  removeAccess(identityId: string): Promise<void> {
    this.accounts.delete(identityId);
    return Promise.resolve();
  }

  grantAdmin(identityId: string, recoveryEmail: string): Promise<void> {
    const wanted = recoveryEmail.toLowerCase();
    const taken = [...this.accounts.values()].some(
      (other) => other.identityId !== identityId && other.recoveryEmail?.toLowerCase() === wanted,
    );
    if (taken) {
      return Promise.reject(new AccountRefusal([ACCOUNT_PROBLEMS.emailTaken]));
    }
    Object.assign(this.account(identityId), { isAdmin: true, recoveryEmail });
    return Promise.resolve();
  }

  revokeAdmin(identityId: string): Promise<void> {
    Object.assign(this.account(identityId), { isAdmin: false, recoveryEmail: null });
    return Promise.resolve();
  }

  /**
   * Signs in as the sign-in screen would: the token for the account with this
   * username and password, or null if there is none.
   */
  signInWith(username: string, password: string): string | null {
    const account = [...this.accounts.values()].find(
      (candidate) => candidate.username === username && candidate.password === password,
    );
    return account ? this.sessionToken(account.identityId) : null;
  }

  /** Gives an account the admin role. */
  makeAdmin(identityId: string): void {
    this.account(identityId).isAdmin = true;
  }

  removeAdmin(identityId: string): void {
    this.account(identityId).isAdmin = false;
  }

  /** Changes the name the provider holds for an account. */
  rename(identityId: string, displayName: string): void {
    this.account(identityId).displayName = displayName;
  }

  /** The token a signed-in person's requests would carry. */
  sessionToken(identityId: string): string {
    return `${TOKEN_PREFIX}${identityId}`;
  }

  private usernameProblems(username: string): string[] {
    const problems: string[] = [];
    if (username.length < 4 || username.length > 64) {
      problems.push(ACCOUNT_PROBLEMS.usernameLength);
    }
    if (!/^[a-z0-9_-]*$/i.test(username) || /^\d+$/.test(username)) {
      problems.push(ACCOUNT_PROBLEMS.usernameCharacters);
    }
    const wanted = username.toLowerCase();
    if ([...this.accounts.values()].some((other) => other.username.toLowerCase() === wanted)) {
      problems.push(ACCOUNT_PROBLEMS.usernameTaken);
    }
    return problems;
  }

  private account(identityId: string): StoredAccount {
    const account = this.accounts.get(identityId);
    if (!account) {
      throw new Error(`No account ${identityId}`);
    }
    return account;
  }
}

function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 8) {
    problems.push(ACCOUNT_PROBLEMS.passwordTooShort);
  }
  if (LEAKED_PASSWORDS.has(password)) {
    problems.push(ACCOUNT_PROBLEMS.passwordLeaked);
  }
  return problems;
}

function toIdentity({ identityId, displayName, isAdmin }: StoredAccount): Identity {
  return { identityId, displayName, isAdmin };
}

function toAccount({ password: _password, ...account }: StoredAccount): Account {
  return account;
}
