import { clerkMiddleware } from "@clerk/nextjs/server";
import { SIGN_IN_PATH } from "@/lib/routes";

// Everything but the sign-in page is private, so a new page is private without
// anyone remembering to make it so. A signed-out visitor is sent to sign in.
// Pages also check for themselves, as Clerk advises, in case a path match here
// ever differs from how Next.js routes the request.
export default clerkMiddleware(
  async (auth, request) => {
    const { pathname } = request.nextUrl;
    if (pathname !== SIGN_IN_PATH && !pathname.startsWith(`${SIGN_IN_PATH}/`)) {
      await auth.protect();
    }
  },
  { signInUrl: SIGN_IN_PATH },
);

export const config = {
  // Every request except the built files, which hold nothing private.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
