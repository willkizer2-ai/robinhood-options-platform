import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
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
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${eagleLake.variable}`}>
      <body>{children}</body>
    </html>
  );
}
