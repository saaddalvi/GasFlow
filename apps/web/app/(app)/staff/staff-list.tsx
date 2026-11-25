"use client";

import type { StaffMember } from "@gasflow/shared";
import { ActionDialog } from "@/components/action-dialog";
import { Field, NewPasswordField } from "@/components/fields";
import { makeAdmin, removeAccess, removeAdminRole, setPassword } from "./actions";

type Account = NonNullable<StaffMember["account"]>;

export function StaffList({ staff, ownId }: { staff: StaffMember[]; ownId: string }) {
  const removed = staff.filter((member) => !member.account);

  return (
    <>
      <Section title="Staff">
        {staff.map(
          ({ account, ...member }) =>
            account && (
              <Member key={member.id} {...member} account={account} isOwn={member.id === ownId} />
            ),
        )}
      </Section>
      {removed.length > 0 && (
        <Section title="Access removed">
          {removed.map((member) => (
            <li key={member.id} className="px-5 py-3 text-sm text-slate-500">
              {member.displayName}
            </li>
          ))}
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {children}
      </ul>
    </section>
  );
}

/** Someone who can sign in, and what can be done about them. */
function Member({
  id,
  displayName,
  account: { username, isAdmin, recoveryEmail },
  isOwn,
}: {
  id: string;
  displayName: string;
  account: Account;
  /** Whether this is the person looking at the screen. */
  isOwn: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 text-sm">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="break-words">{displayName}</span>
          {isAdmin && <Tag className="bg-brand-50 text-brand-700">Admin</Tag>}
          {isOwn && <Tag className="bg-slate-100 text-slate-600">You</Tag>}
        </p>
        {username && <p className="break-all text-slate-500">Username: {username}</p>}
        {/* Shown for anyone who has one, so that a leftover address is never hidden. */}
        {recoveryEmail ? (
          <p className="break-all text-slate-500">Recovery email: {recoveryEmail}</p>
        ) : (
          isAdmin && <p className="text-amber-700">No recovery email. Add one.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <ActionDialog
          trigger="Set password"
          title={`New password for ${displayName}`}
          description={
            isOwn
              ? "You will be signed out within a minute or so. Sign in again with the new password."
              : "Tell them the new password yourself. They will be signed out within a minute or so."
          }
          submitLabel="Set password"
          action={setPassword.bind(null, id)}
        >
          <NewPasswordField label="New password" name="password" required />
        </ActionDialog>
        <RecoveryEmailDialog
          // A new one once the role changes, so that its words match.
          key={String(isAdmin)}
          id={id}
          displayName={displayName}
          isAdmin={isAdmin}
          recoveryEmail={recoveryEmail}
        />
        {!isOwn && isAdmin && (
          <ActionDialog
            trigger="Remove admin role"
            title={`Remove ${displayName}'s admin role?`}
            description="They stay on the staff and can still sign in. Their recovery email is removed."
            submitLabel="Remove admin role"
            danger
            action={removeAdminRole.bind(null, id)}
          />
        )}
        {!isOwn && (
          <ActionDialog
            trigger="Remove access"
            title={`Remove ${displayName}'s access?`}
            description="Their account is deleted, so they can no longer sign in. Their name stays on what they recorded. This cannot be undone."
            submitLabel="Remove access"
            danger
            action={removeAccess.bind(null, id)}
          />
        )}
      </div>
    </li>
  );
}

/** Gives the admin role, or changes an admin's recovery email. */
function RecoveryEmailDialog({
  id,
  displayName,
  isAdmin,
  recoveryEmail,
}: {
  id: string;
  displayName: string;
  isAdmin: boolean;
  recoveryEmail: string | null;
}) {
  return (
    <ActionDialog
      trigger={isAdmin ? "Recovery email" : "Make admin"}
      title={isAdmin ? `Recovery email for ${displayName}` : `Make ${displayName} an admin`}
      description={
        isAdmin
          ? "A code to reset a forgotten password goes to this address."
          : "Admins can manage staff and make sensitive changes. Each one needs a recovery email."
      }
      submitLabel={isAdmin ? "Save email" : "Make admin"}
      action={makeAdmin.bind(null, id)}
    >
      <Field
        label="Recovery email"
        name="recoveryEmail"
        type="email"
        required
        defaultValue={recoveryEmail ?? ""}
        autoComplete="off"
        hint="Check it carefully: whoever reads this inbox can reset the password."
      />
    </ActionDialog>
  );
}

function Tag({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs ${className}`}>{children}</span>;
}
