import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { APP_URL } from '@/lib/robinhood';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'The Amarium — the Sky',
  description:
    'The public firmament outside the glass: every inscribed star, every seat still waiting. Remembrance and reunion, never speculation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav>
          <Link href="/">The Amarium</Link>
          <Link href="/sky">The Sky</Link>
          <Link href="/claim">Inscribe</Link>
          <a href={APP_URL}>Open the device ↗</a>
        </nav>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
