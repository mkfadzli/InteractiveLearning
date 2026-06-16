import type { Metadata, Viewport } from "next";
import "./globals.css";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "InteractiveLearning — Hetnet Wireless Technologies",
  description:
    "Turn any PDF into an immersive course with story lessons, quizzes, and progress tracking.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** Runs before paint: applies saved theme or system preference. No FOUC. */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem("il-theme");
    if (!t) t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = t;
  } catch(e) {}
})();`;

/*
 * Fonts are loaded via <link> so the project builds without network access.
 * For production, prefer self-hosted fonts via next/font/google:
 *   const inter = Inter({ subsets:["latin"], variable:"--font-inter", display:"swap" });
 * and apply the variables on <body>. See README — "Fonts".
 */
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600;700;800&display=swap";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
