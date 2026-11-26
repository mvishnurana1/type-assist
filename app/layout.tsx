import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
// Atkinson Hyperlegible: a font designed for low-vision readers. Bundled locally so it works offline.
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Type Assist',
  description: 'A friendly typing trainer that scores how quickly you type each character.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
