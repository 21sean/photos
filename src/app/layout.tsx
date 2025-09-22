import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Script from 'next/script';
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
    url: 'https://sean.ventures', // Updated to match current deployment
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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="HandheldFriendly" content="true" />
        <meta name="MobileOptimized" content="width" />
        <meta name="screen-orientation" content="portrait" />
        <meta name="x5-orientation" content="portrait" />
        <meta name="full-screen" content="yes" />
        <meta name="x5-fullscreen" content="true" />
        <meta name="browsermode" content="application" />
        <meta name="x5-page-mode" content="app" />
        <Script id="set-screen-height" strategy="beforeInteractive">
          {`
            function setScreenMetrics() {
              const docEl = document.documentElement;
              const visualViewportHeight = window.visualViewport?.height ?? 0;
              const innerHeight = window.innerHeight ?? 0;
              const outerHeight = window.outerHeight ?? 0;
              const clientHeight = docEl?.clientHeight ?? 0;
              const screenHeight = window.screen?.height ?? 0;
              const viewportHeight = Math.max(
                visualViewportHeight,
                innerHeight,
                outerHeight,
                clientHeight,
                screenHeight
              );

              if (viewportHeight > 0) {
                docEl.style.setProperty('--screen-h', viewportHeight + 'px');
              }

              if (screenHeight > 0) {
                docEl.style.setProperty('--outer-h', screenHeight + 'px');
              } else if (outerHeight > 0) {
                docEl.style.setProperty('--outer-h', outerHeight + 'px');
              }
            }
            setScreenMetrics();
            addEventListener('orientationchange', setScreenMetrics, { passive: true });
            addEventListener('pageshow', setScreenMetrics, { passive: true });
            addEventListener('resize', setScreenMetrics, { passive: true });
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
