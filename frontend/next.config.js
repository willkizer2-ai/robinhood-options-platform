/** @type {import('next').NextConfig} */

// BACKEND_URL is set in Vercel dashboard / vercel.json for production.
// Falls back to localhost for local development.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

// Clerk publishable key is PUBLIC by design (Clerk ships it to every browser).
// Vercel's env var takes precedence; this committed default keeps builds working.
// The SECRET key is never here — it lives only in Render's backend environment.
const clerkPublishable =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  'pk_test_c3RlYWR5LW94LTkzLmNsZXJrLmFjY291bnRzLmRldiQ';

const nextConfig = {
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishable,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/login',
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/signup',
  },
  // Allow the app to be served from any host (Vercel, Cloudflare tunnel, etc.)
  // without Next.js blocking the request with a hostname check.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ];
  },
  async rewrites() {
    return [
      {
        // Proxy all /api/* calls to the FastAPI backend (server-side).
        // In production this hits the Render backend URL; locally it hits :8000.
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
