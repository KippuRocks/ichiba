/**
 * Ichiba's screens: the table the router's pages render from (`F-070` plan §5.4).
 *
 * Every screen has a stable `screenId`, the route it is shown at, a title, and
 * the chrome it is shown inside. Routes are the app router's, written with
 * `:name` for a dynamic segment, so `src/app/events/[event]/page.tsx` is
 * `/events/:event`. A route with several steps declares one screen per step.
 * A screen whose route is `null` has no URL of its own, such as the page shown
 * for a URL that names nothing.
 *
 * Screen ids name what the screen is for, as `area.subject.step`. They never
 * name copy, positions or indices, so copy can change without breaking them.
 * An id, once used, is not renamed: journeys, screenshots and the navigation map
 * in `kippu-e2e` refer to it.
 *
 * `tools/screens` reads this table, where each `<Screen id>` is rendered in
 * `src/app/`, and the navigation declared in the sources, to generate
 * `screens.json`, and fails when they disagree. This module imports nothing, so
 * the tool can load it without the app.
 */

export interface ScreenDefinition {
  readonly title: string;
  /** The app router route, such as `/events/:event`; `null` for a screen with no URL of its own. */
  readonly route: string | null;
  /** The chrome the screen is shown inside, whose navigation every such screen has. */
  readonly chrome: ChromeId | null;
}

/** Navigation shared by every screen shown inside it, such as the site header. */
export const CHROME = {
  site: { title: "Site header" },
} as const;

export type ChromeId = keyof typeof CHROME;

export const SCREENS = {
  home: { title: "Ichiba", route: "/", chrome: "site" },
  "event.detail": { title: "Event", route: "/events/:event", chrome: "site" },
  "event.seats": {
    title: "Choose a seat",
    route: "/events/:event/zones/:zone/seats",
    chrome: "site",
  },
  "checkout.handoff": { title: "Checkout: continue in Saifu", route: "/checkout", chrome: "site" },
  "checkout.pairing": { title: "Checkout: check the code", route: "/checkout", chrome: "site" },
  "checkout.hold": { title: "Checkout: hold your ticket", route: "/checkout", chrome: "site" },
  "checkout.refused": { title: "Checkout: not available", route: "/checkout", chrome: "site" },
  "checkout.pay": { title: "Checkout: pay", route: "/checkout", chrome: "site" },
  "checkout.processing": {
    title: "Checkout: issuing your ticket",
    route: "/checkout",
    chrome: "site",
  },
  "checkout.done": {
    title: "Checkout: your ticket is in Saifu",
    route: "/checkout",
    chrome: "site",
  },
  "checkout.refund": { title: "Checkout: refund owed", route: "/checkout", chrome: "site" },
  "checkout.ended": { title: "Checkout: ended", route: "/checkout", chrome: "site" },
  "checkout.none": { title: "Checkout: none in progress", route: "/checkout", chrome: "site" },
  "system.not-found": { title: "Page not found", route: null, chrome: "site" },
} as const satisfies Readonly<Record<string, ScreenDefinition>>;

export type ScreenId = keyof typeof SCREENS;

/** Another app's screen, as the target of a handoff: `saifu:<screenId>`. */
export type ExternalScreenId = `saifu:${string}`;

/** The apps a navigation may hand off to. */
export const EXTERNAL_APPS = ["saifu"] as const;
