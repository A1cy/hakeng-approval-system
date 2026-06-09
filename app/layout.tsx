import type { Metadata } from "next";
import { Montserrat, Merriweather, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { AppHeader } from "@/components/app-header";

const fontSans = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Merriweather({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-serif",
});

const fontMono = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "HAK Engineering - Approval Workflow",
  description: "Document request approval system with sequential workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} font-sans antialiased`}>
        <AppHeader />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </body>
    </html>
  );
}
