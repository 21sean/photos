import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const sansSerifFont = localFont({
  src: '../fonts/TASAOrbiterVF.woff2',
  display: 'swap',
  variable: '--font-sans'
});

export const metadata: Metadata = {
  title: 'sean.photo',
  description: 'HDR Photography Portfolio',
  openGraph: {
    title: 'sean.photo',
    description: 'HDR Photography Portfolio',
    url: 'https://photos.sean.photo',
    siteName: "sean.photo",
    images: [
      {
        url: 'https://images.ctfassets.net/hgydmrrpr52m/51698HSeL6XwsGGkNoevym/fe4b55fbcb4431a6a75f14e6b2ebeb6b/meta_tag_1.jpg',
        width: 1200,
        height: 630
      }
    ],
    locale: 'en_US',
    type: 'website'
  }
 
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sansSerifFont.variable} font-sans`}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta name="viewport" content="width=device-width, initial-scale=1, color-scheme=light dark" />
      </head>
      <body>{children}</body>
    </html>
  );
}
