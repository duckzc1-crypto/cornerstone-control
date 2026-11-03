import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cornerstone Control",
  description: "Fleet and boost control panel",
};

// Resolve the theme before first paint so there is no flash.
const themeScript = `(function(){try{var m=localStorage.getItem('cc-theme');if(m!=='light'&&m!=='dark')m='dark';var d=document.documentElement;d.dataset.theme=m;d.style.colorScheme=m;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
