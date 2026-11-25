"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { SIGN_IN_PATH } from "@/lib/routes";
import { LogoMark } from "./logo-mark";

const LINKS = [{ href: "/", label: "Gases" }];

export function NavBar({ shopName, staffName }: { shopName: string; staffName?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <LogoMark />
          <span className="truncate font-semibold">{shopName}</span>
        </Link>
        <nav aria-label="Main" className="hidden gap-1 md:flex">
          <NavLinks />
        </nav>
        <AccountMenu staffName={staffName} />
        <PhoneMenu staffName={staffName} />
      </div>
    </header>
  );
}

function NavLinks() {
  const pathname = usePathname();
  return LINKS.map(({ href, label }) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`rounded-md px-3 py-2 text-sm ${
          active ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        {label}
      </Link>
    );
  });
}

/** Sign out, behind the staff member's name, on a wider screen. */
function AccountMenu({ staffName }: { staffName?: string }) {
  const { ref } = useMenu();

  return (
    <details ref={ref} className="relative ml-auto hidden md:block">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <span className="max-w-48 truncate">{staffName ?? "Account"}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-none stroke-current">
          <path d="m6 9 6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        <SignOut />
      </div>
    </details>
  );
}

/** The whole navigation, including sign out, behind one button on a phone. */
function PhoneMenu({ staffName }: { staffName?: string }) {
  const { ref, close } = useMenu();

  return (
    <details ref={ref} className="ml-auto md:hidden">
      <summary
        aria-label="Menu"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 stroke-current stroke-2">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
      </summary>
      <div className="absolute inset-x-0 top-14 border-b border-slate-200 bg-white p-4 shadow-lg">
        <nav aria-label="Main" className="flex flex-col gap-1" onClick={close}>
          <NavLinks />
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

/** For a `<details>` menu: closes it on Escape or a click elsewhere. */
function useMenu() {
  const ref = useRef<HTMLDetailsElement>(null);

  function close() {
    ref.current?.removeAttribute("open");
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

  return { ref, close };
}
