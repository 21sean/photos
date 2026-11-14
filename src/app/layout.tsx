import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { IMAGE_ORIGIN } from '@/lib/r2';
import './globals.css';

// One typeface, Instrument Sans, in a single variable file: its weight and
// width axes do the work a second and third family would otherwise do.
const sans = localFont({
  src: '../fonts/InstrumentSans-Variable.woff2',
  weight: '400 700',
  display: 'swap',
  variable: '--font-instrument-sans',
  declarations: [{ prop: 'font-stretch', value: '75% 100%' }]
});

const description =
  'Travel photographs from around the world, shot in HDR. Spin the globe and pick a destination.';

export const metadata: Metadata = {
  title: 'sean.photo',
  description,
  openGraph: {
    title: 'sean.photo',
    description,
    url: 'https://sean.ventures',
    siteName: 'sean.photo',
    locale: 'en_US',
    type: 'website'
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent'
  },
  formatDetection: { telephone: false }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor: '#050a0c'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} font-sans`}
    >
      <head>
        {/* Every photo comes from the image bucket: open the connection early */}
        <link rel="preconnect" href={IMAGE_ORIGIN} />
      </head>
      <body>{children}</body>
    </html>
  );
}
