import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that require a signed-in account. The dashboard and account/setup flows
// are gated; the landing page, replays, auth pages, and pricing stay public.
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/setup(.*)',
  '/account(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except static assets and Next internals
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run on API routes
    '/(api|trpc)(.*)',
  ],
};
