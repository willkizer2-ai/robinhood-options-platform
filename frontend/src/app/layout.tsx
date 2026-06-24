import type { Metadata } from 'next';
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${eagleLake.variable}`}>
      <body>{children}</body>
    </html>
  );
}
