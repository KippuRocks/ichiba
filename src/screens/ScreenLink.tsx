import Link from "next/link";
import type { ReactNode } from "react";
import type { ChromeId, ScreenId } from "./registry.ts";
import { hrefOf, type ParamsOf, type RoutedScreenId } from "./routes.ts";

/**
 * A link to a screen. `from` names the screen, or chrome, the link is shown on,
 * literally, so `tools/screens` can record the edge in `screens.json`.
 */
export function ScreenLink<Id extends RoutedScreenId>({
  to,
  params,
  query,
  className,
  children,
}: {
  from: ScreenId | `chrome:${ChromeId}`;
  to: Id;
  params: ParamsOf<Id>;
  /** Search parameters, such as the page of a list; they never change which screen is shown. */
  query?: Readonly<Record<string, string>>;
  className?: string;
  children: ReactNode;
}) {
  const search = query === undefined ? "" : new URLSearchParams(query).toString();
  const href = search === "" ? hrefOf(to, params) : `${hrefOf(to, params)}?${search}`;
  return (
    <Link href={href} className={className} prefetch={false}>
      {children}
    </Link>
  );
}
