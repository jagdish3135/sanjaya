import type { Metadata, Viewport } from "next";
import { Martian_Mono, Mukta, Rozha_One } from "next/font/google";
import "./globals.css";

const display = Rozha_One({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin", "devanagari"],
});

const body = Mukta({
  variable: "--font-body",
  weight: ["300", "400", "500", "700"],
  subsets: ["latin", "devanagari"],
});

const mono = Martian_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sanjaya · the world, seen live",
  description:
    "A live 3D globe of what is happening on Earth right now, starting with earthquakes from USGS and EMSC. India-first, free and open source.",
};

export const viewport: Viewport = {
  themeColor: "#07080f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
