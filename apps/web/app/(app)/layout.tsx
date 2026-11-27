import { auth } from "@clerk/nextjs/server";
import { NavBar } from "@/components/nav-bar";
import { fetchMe, fetchShop, orNull } from "@/lib/api";

/** The frame around every page a signed-in staff member sees. */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await auth.protect();
  const [shop, me] = await Promise.all([orNull(fetchShop()), orNull(fetchMe())]);

  return (
    <>
      <NavBar
        shopName={shop?.name ?? "GasFlow"}
        staffName={me?.displayName}
        isAdmin={me?.isAdmin}
      />
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
    </>
  );
}
