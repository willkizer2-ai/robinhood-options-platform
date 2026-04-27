/** @type {import('next').NextConfig} */

// BACKEND_URL is set in Vercel dashboard / vercel.json for production.
// Falls back to localhost for local development.
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig = {
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
