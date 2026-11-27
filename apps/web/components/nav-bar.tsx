"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import {
  BALANCE_REGISTER_PATH,
  BILLS_PATH,
  DASHBOARD_PATH,
  DAY_LEDGER_PATH,
  GASES_PATH,
  OPENING_STOCK_PATH,
  PARTIES_PATH,
  RECEIVE_EMPTIES_PATH,
  SIGN_IN_PATH,
  STOCK_CARD_PATH,
  STOCK_REPORT_PATH,
  VEHICLES_PATH,
} from "@/lib/routes";
import { LogoMark } from "./logo-mark";

interface NavLink {
  href: string;
  label: string;
}

const LINKS: (NavLink & { adminOnly?: boolean })[] = [
  { href: DASHBOARD_PATH, label: "Dashboard" },
  { href: RECEIVE_EMPTIES_PATH, label: "Receive empties" },
  { href: BILLS_PATH, label: "Bills" },
  { href: PARTIES_PATH, label: "Parties" },
  { href: GASES_PATH, label: "Gases" },
  { href: VEHICLES_PATH, label: "Vehicles" },
  { href: OPENING_STOCK_PATH, label: "Opening stock" },
  { href: "/staff", label: "Staff", adminOnly: true },
];

const REPORT_LINKS: NavLink[] = [
  { href: STOCK_REPORT_PATH, label: "Stock" },
  { href: DAY_LEDGER_PATH, label: "Day ledger" },
  { href: BALANCE_REGISTER_PATH, label: "Balance register" },
  { href: STOCK_CARD_PATH, label: "Stock card" },
];

export function NavBar({
  shopName,
  staffName,
  isAdmin = false,
}: {
  shopName: string;
  staffName?: string;
  isAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href={DASHBOARD_PATH} className="flex min-w-0 items-center gap-2">
          <LogoMark />
          <span className="truncate font-semibold">{shopName}</span>
        </Link>
        <nav aria-label="Main" className="hidden gap-1 lg:flex">
          <RowOfLinks isAdmin={isAdmin} />
        </nav>
        <AccountMenu staffName={staffName} />
        <CollapsedMenu staffName={staffName} isAdmin={isAdmin} />
      </div>
    </header>
  );
}

/** The links this person may see, and the address of the one for the current page. */
function useNavLinks(isAdmin: boolean) {
  const pathname = usePathname();
  // A link stays marked on the pages under it, unless another link is closer.
  const current = [...LINKS, ...REPORT_LINKS]
    .map((link) => link.href)
    .filter(
      (href) => pathname === href || (href !== DASHBOARD_PATH && pathname.startsWith(`${href}/`)),
    )
    .sort((a, b) => b.length - a.length)[0];
  return { links: LINKS.filter((link) => isAdmin || !link.adminOnly), current };
}

/** The navigation in a row, with the reports behind one name, on a wider screen. */
function RowOfLinks({ isAdmin }: { isAdmin: boolean }) {
  const { links, current } = useNavLinks(isAdmin);
  return (
    <>
      {links.map((link) => (
        <PageLink key={link.href} link={link} current={current} />
      ))}
      <ReportsMenu current={current} />
    </>
  );
}

/** The navigation as a list in two named groups, for the menu of a narrower screen. */
function ListOfLinks({ isAdmin }: { isAdmin: boolean }) {
  const { links, current } = useNavLinks(isAdmin);
  return (
    <>
      <LinkGroup label="Operational" links={links} current={current} />
      <LinkGroup label="Reporting" links={REPORT_LINKS} current={current} />
    </>
  );
}

function linkStyles(active: boolean): string {
  return `rounded-md px-3 py-2 text-sm lg:px-2 xl:px-3 ${
    active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100"
  }`;
}

/** A link to a page, marked when it is the current one. */
function PageLink({ link: { href, label }, current }: { link: NavLink; current?: string }) {
  const active = href === current;
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={linkStyles(active)}>
      {label}
    </Link>
  );
}

function ReportsMenu({ current }: { current?: string }) {
  const { ref, closeOnLink } = useMenu();
  const active = REPORT_LINKS.some((link) => link.href === current);

  return (
    <details ref={ref} className="relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${linkStyles(active)}`}
      >
        Reports
        <Chevron />
      </summary>
      <div
        className="absolute left-0 top-full mt-2 flex w-48 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        onClick={closeOnLink}
      >
        {REPORT_LINKS.map((link) => (
          <PageLink key={link.href} link={link} current={current} />
        ))}
      </div>
    </details>
  );
}

/** Links listed under one name. */
function LinkGroup({
  label,
  links,
  current,
}: {
  label: string;
  links: NavLink[];
  current?: string;
}) {
  const headingId = useId();

  return (
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-1">
      <p
        id={headingId}
        className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
      >
        {label}
      </p>
      {links.map((link) => (
        <PageLink key={link.href} link={link} current={current} />
      ))}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current">
      <path d="m6 9 6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Sign out, behind the staff member's name, on a wider screen. */
function AccountMenu({ staffName }: { staffName?: string }) {
  const { ref } = useMenu();

  return (
    <details ref={ref} className="relative ml-auto hidden lg:block">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <span className="max-w-48 truncate">{staffName ?? "Account"}</span>
        <Chevron />
      </summary>
      <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        <SignOut />
      </div>
    </details>
  );
}

/** The whole navigation, including sign out, behind one button on a narrower screen. */
function CollapsedMenu({ staffName, isAdmin }: { staffName?: string; isAdmin: boolean }) {
  const { ref, closeOnLink } = useMenu();

  return (
    <details ref={ref} className="ml-auto lg:hidden">
      <summary
        aria-label="Menu"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 stroke-current stroke-2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </summary>
      {/* Scrolls by itself if it is taller than the screen, because the header stays put. */}
      <div className="absolute inset-x-0 top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-lg">
        <nav aria-label="Main" className="flex flex-col gap-3" onClick={closeOnLink}>
          <ListOfLinks isAdmin={isAdmin} />
        </nav>
        <div className="mt-3 border-t border-slate-100 pt-3">
          {staffName && (
            <p className="mb-1 px-3 text-sm text-slate-500">Signed in as {staffName}</p>
          )}
          <SignOut />
        </div>
      </div>
    </details>
  );
}

function SignOut() {
  return (
    <SignOutButton redirectUrl={SIGN_IN_PATH}>
      <button
        type="button"
        className="w-full rounded-md px-3 py-3 text-left text-sm text-slate-600 hover:bg-slate-100"
      >
        Sign out
      </button>
    </SignOutButton>
  );
}

/**
 * For a `<details>` menu: closes it on Escape or a click elsewhere, and gives the
 * means to close it when one of its links is chosen.
 */
function useMenu() {
  const ref = useRef<HTMLDetailsElement>(null);

  function close() {
    ref.current?.removeAttribute("open");
  }

  /** A click on anything else in the menu, such as a heading, leaves it open. */
  function closeOnLink({ target }: React.MouseEvent) {
    if ((target as Element).closest("a")) close();
  }

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) close();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return { ref, closeOnLink };
}
