"use client";

import { SignOutButton, UserButton } from "@clerk/nextjs";
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
        <div className="ml-auto hidden items-center gap-3 md:flex">
          {staffName && <span className="text-sm text-slate-600">{staffName}</span>}
          <UserButton />
        </div>
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

/** The whole navigation, including sign out, behind one button on a phone. */
function PhoneMenu({ staffName }: { staffName?: string }) {
  const menu = useRef<HTMLDetailsElement>(null);

  function close() {
    menu.current?.removeAttribute("open");
  }

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) close();
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

  return (
    <details ref={menu} className="ml-auto md:hidden">
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
          {staffName && <p className="px-3 text-sm text-slate-500">Signed in as {staffName}</p>}
          <SignOutButton redirectUrl={SIGN_IN_PATH}>
            <button
              type="button"
              className="mt-1 w-full rounded-md px-3 py-3 text-left text-sm text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>
    </details>
  );
}
