import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap", preload: false });

// Runs before the page is drawn: reads the language and accessibility choices
// from cookies, so Arabic is right-to-left from the first frame.
const BOOT = `(function(){try{var c=document.cookie,d=document.documentElement;
var ar=/(?:^|; )loop_locale=ar/.test(c);d.lang=ar?"ar":"en";d.dir=ar?"rtl":"ltr";
var a=(c.match(/(?:^|; )loop_a11y=([^;]*)/)||[])[1]||"";a=decodeURIComponent(a);
if(a.indexOf("large")>-1)d.classList.add("a11y-large");if(a.indexOf("calm")>-1)d.classList.add("a11y-calm");}catch(e){}})();`;

export const metadata: Metadata = {
  title: { default: "Loop", template: "%s · Loop" },
  description: "Your school's private space for clubs, events and friends.",
  // Private site: keep it out of search engines.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/loop-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Loop", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#466237",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" className={`${display.variable} ${body.variable} ${arabic.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
