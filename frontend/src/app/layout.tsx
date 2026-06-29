import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

// Web Trace webfonts (copy the .ttf files from design-system/assets/fonts/ into
// src/app/fonts/). These map to the CSS variables the design system reads.
const spaceGrotesk = localFont({
  src: [
    { path: './fonts/SpaceGrotesk-Variable.ttf', weight: '300 700', style: 'normal' },
  ],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const jetbrainsMono = localFont({
  src: [{ path: './fonts/JetBrainsMono-Variable.ttf', weight: '100 800', style: 'normal' }],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
const eagleLake = localFont({
  src: [{ path: './fonts/EagleLake-Regular.ttf', weight: '400', style: 'normal' }],
  variable: '--font-eagle-lake',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Web Trace Portfolio Management',
  description: 'Real options intelligence — credible setups, live execution levels, an honest backtested edge. By Will Kizer.',
  icons: { icon: '/brand/logo-mark.svg' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Web Trace',
  },
  formatDetection: { telephone: false },
};

// Critical for iOS Safari: without width=device-width the page renders at desktop
// width and zooms out. viewportFit=cover respects the iPhone notch / safe areas.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#161619',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const html = (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${eagleLake.variable}`}>
      <body>{children}</body>
    </html>
  );

  // Only mount ClerkProvider when a publishable key is available, so the app
  // renders normally before auth is configured in the deploy environment.
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) return html;

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#b4b4cc',
          colorBackground: '#161619',
          colorInputBackground: '#232329',
          colorInputText: '#f4f4f9',
          colorText: '#f4f4f9',
          colorTextSecondary: '#a9aab8',
          colorNeutral: '#8a8b9c',
          borderRadius: '10px',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
        },
        elements: {
          card: { backgroundColor: '#1c1c21', border: '1px solid rgba(180,180,204,0.14)' },
          formButtonPrimary: { backgroundColor: '#b4b4cc', color: '#111114', textTransform: 'none' },
          footerActionLink: { color: '#c7c9e0' },
        },
      }}
    >
      {html}
    </ClerkProvider>
  );
}
