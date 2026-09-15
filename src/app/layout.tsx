import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ScreenLink } from "../screens/ScreenLink.tsx";
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
          <ScreenLink from="chrome:site" to="home" params={{}} className="site-name">
            Ichiba
          </ScreenLink>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
