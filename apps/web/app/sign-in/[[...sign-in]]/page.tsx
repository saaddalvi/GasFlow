import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { LogoMark } from "@/components/logo-mark";

export const metadata: Metadata = {
  title: "Sign in · GasFlow",
};

export default function SignInPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-center gap-6 bg-gradient-to-br from-brand-50 to-brand-100 p-12 lg:flex">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-700">
          Cylinder ledger
        </p>
        <p className="max-w-md text-4xl font-bold tracking-tight">Every cylinder, accounted for.</p>
        <Cylinders />
      </div>
      <div className="flex flex-col items-center justify-center gap-6 bg-white px-4 py-10">
        {/* Clerk's card below shows the name. */}
        <LogoMark />
        <SignIn withSignUp={false} fallbackRedirectUrl="/" />
      </div>
    </main>
  );
}

const CYLINDER_COLOURS = [
  "fill-brand-600",
  "fill-emerald-600",
  "fill-slate-700",
  "fill-amber-500",
  "fill-rose-600",
  "fill-slate-400",
];

/** Six coloured cylinders standing in a row. */
function Cylinders() {
  return (
    <svg viewBox="0 0 312 168" aria-hidden="true" className="w-full max-w-md">
      <ellipse cx="156" cy="158" rx="150" ry="8" className="fill-brand-200" />
      {CYLINDER_COLOURS.map((colour, index) => (
        <g key={colour} transform={`translate(${12 + index * 50} 0)`}>
          <path d="M13 8h12v12H13z" className="fill-slate-500" />
          <path
            d="M19 18c11 0 19 9 19 20v114a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V38c0-11 8-20 19-20Z"
            className={colour}
          />
          <path d="M7 42v104" className="stroke-white/40 stroke-[5]" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}
