import { redirect } from "next/navigation";
import type { ChromeId, ExternalScreenId, ScreenId } from "./registry.ts";
import { hrefOf, type ParamsOf, type RoutedScreenId } from "./routes.ts";

/**
 * Navigates to a screen from a server component or action, by redirecting.
 * `from` names the screen the call is made on, literally, so `tools/screens`
 * can record the edge. `query` adds search parameters, which never change the
 * route.
 */
export function navigate<Id extends RoutedScreenId>(
  _from: ScreenId | `chrome:${ChromeId}`,
  to: Id,
  params: ParamsOf<Id>,
  query?: Readonly<Record<string, string>>,
): never {
  const search = query === undefined ? "" : new URLSearchParams(query).toString();
  redirect(search === "" ? hrefOf(to, params) : `${hrefOf(to, params)}?${search}`);
}

/**
 * Sends the buyer away from Ichiba to a page no app of Kippu's renders, such as
 * the payment provider's hosted checkout. It is not an edge between screens: the
 * buyer comes back to the URL Ichiba gave the provider. `from` names the screen
 * literally, so `tools/screens` accounts for the call.
 */
export function leave(_from: ScreenId, url: string): never {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error(`refusing to send the buyer to a non-https page: ${parsed.origin}`);
  }
  redirect(parsed.href);
}

/**
 * Declares a transition from one screen to another that the router does not
 * make: a step in a flow, or a handoff to another app's screen, written
 * `saifu:<screenId>`. It answers `to`, so it stands where the transition
 * happens. `tools/screens` reads every call, which must name both screens
 * literally.
 */
export function transition<To extends ScreenId | ExternalScreenId>(
  _from: ScreenId | `chrome:${ChromeId}`,
  to: To,
): To {
  return to;
}
