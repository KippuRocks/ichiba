import type { ReactNode } from "react";
import type { ExternalScreenId, ScreenId } from "./registry.ts";

/**
 * A link that opens another app's screen, such as Saifu's `checkout.link`, at
 * the URL that app handles (a universal link). `from` and `to` name both screens
 * literally, so `tools/screens` records the edge between apps.
 */
export function AppLink({
  href,
  className,
  children,
}: {
  from: ScreenId;
  to: ExternalScreenId;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className} rel="noopener">
      {children}
    </a>
  );
}
