import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://arbitraj.amfb.ro"),

  title: "CMA București",

  description:
    "Platforma oficială de testare teoretică a Comisiei Municipale a Arbitrilor București.",

  openGraph: {
    title: "Comisia Municipală a Arbitrilor București",

    description:
      "Platforma oficială de testare teoretică pentru arbitri.",

    url: "https://arbitraj.amfb.ro",

    siteName: "CMA București",

    type: "website",

    images: [
      {
        url: "/images/share-preview.jpg",
        width: 1200,
        height: 630,
        alt: "Comisia Municipală a Arbitrilor București",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",

    title: "Comisia Municipală a Arbitrilor București",

    description:
      "Platforma oficială de testare teoretică pentru arbitri.",

    images: ["/images/share-preview.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}