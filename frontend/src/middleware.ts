import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Routes that require a signed-in account. The dashboard and account/setup flows
// are gated; the landing page, replays, auth pages, and pricing stay public.
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/setup(.*)',
  '/account(.*)',
]);

// Auth is only enforced when Clerk is actually configured (keys present in the
// environment). If the keys aren't set yet, the middleware is a no-op so the
// site stays fully functional (public) instead of returning 500s. Auth activates
// automatically once CLERK keys are added to the Vercel environment.
const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY);

export default clerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    })
  : function passthrough() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
