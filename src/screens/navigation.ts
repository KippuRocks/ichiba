import { redirect } from "next/navigation";
import type { ChromeId, ExternalScreenId, ScreenId } from "./registry.ts";
import { hrefOf, type ParamsOf, type RoutedScreenId } from "./routes.ts";

/**
 * Navigates to a screen from a server component or action, by redirecting.
 * `from` names the screen the call is made on, literally, so `tools/screens`
 * can record the edge.
 */
export function navigate<Id extends RoutedScreenId>(
  _from: ScreenId | `chrome:${ChromeId}`,
  to: Id,
  params: ParamsOf<Id>,
): never {
  redirect(hrefOf(to, params));
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
