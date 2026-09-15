import { SCREENS, type ScreenId } from "./registry.ts";

type RouteOf<Id extends ScreenId> = (typeof SCREENS)[Id]["route"];

type ParamNames<Route> = Route extends `${string}:${infer Name}/${infer Rest}`
  ? Name | ParamNames<`/${Rest}`>
  : Route extends `${string}:${infer Name}`
    ? Name
    : never;

/** The parameters a screen's route needs, such as `{ event }` for `/events/:event`. */
export type ParamsOf<Id extends ScreenId> = { readonly [Name in ParamNames<RouteOf<Id>>]: string };

/** A screen that has a URL: the only kind a link or `navigate` can reach. */
export type RoutedScreenId = {
  [Id in ScreenId]: RouteOf<Id> extends string ? Id : never;
}[ScreenId];

/** A screen's path, with its parameters filled in. */
export function hrefOf<Id extends RoutedScreenId>(screen: Id, params: ParamsOf<Id>): string {
  const route = SCREENS[screen].route as string;
  return route.replace(/:([A-Za-z]+)/g, (_, name: string) => {
    const value = (params as Readonly<Record<string, string>>)[name];
    if (value === undefined) {
      throw new Error(`${screen} needs the parameter ${name}`);
    }
    return encodeURIComponent(value);
  });
}

/**
 * The route a file under `src/app/` renders at, in the registry's notation:
 * route groups `(name)` are dropped, dynamic segments `[name]` become `:name`.
 * `null` for a file that is not part of a route, such as a private `_folder`.
 */
export function routeOfDirectory(segments: readonly string[]): string | null {
  const parts: string[] = [];
  for (const segment of segments) {
    if (segment.startsWith("_")) return null;
    if (segment.startsWith("(") && segment.endsWith(")")) continue;
    const dynamic = /^\[([A-Za-z]+)\]$/.exec(segment);
    parts.push(dynamic ? `:${dynamic[1]}` : segment);
  }
  return `/${parts.join("/")}`;
}
