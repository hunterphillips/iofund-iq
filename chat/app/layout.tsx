import type { Metadata } from "next";
import "@neondatabase/auth-ui/css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "iofund-agent",
  description: "Personal AI assistant over an I/O Fund subscription.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
