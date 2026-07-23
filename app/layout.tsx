import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "Recipe Cost Calculator";
const description =
  "A compact recipe formula, production batch, yield and costing application.";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim();
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    firstHeaderValue(requestHeaders.get("x-forwarded-host")) ??
    firstHeaderValue(requestHeaders.get("host")) ??
    "localhost:3000";
  const protocol =
    firstHeaderValue(requestHeaders.get("x-forwarded-proto")) ??
    (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const imageUrl = `${origin}/og.png`;

  return {
    title,
    description,
    metadataBase: new URL(origin),
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: "Recipe Cost Calculator formula and production costing interface",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
