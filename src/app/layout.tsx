import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ichiba", template: "%s · Ichiba" },
  description: "Find events and buy tickets.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <span className="site-name">Ichiba</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
