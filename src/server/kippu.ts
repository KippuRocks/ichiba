import type { AppRouter } from "@kippurocks/api";
import { createTRPCClient, httpLink, type TRPCClient } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";

/**
 * Where Ichiba's server reaches the Kippu API's tRPC router (`C5`). The browser
 * never calls it: pages are rendered on the server (`AD-03`). Read at request
 * time, so one build runs against any API.
 */
export function apiUrl(): string {
  return process.env.KIPPU_API_URL ?? "http://127.0.0.1:8080";
}

export type KippuClient = TRPCClient<AppRouter>;

/**
 * A client for the `C5` contract, for server components and route handlers. It
 * carries no session: browsing needs no account, no keys and no wallet
 * (`REQ-MP-7`). Ichiba holds no keys and signs nothing (`REQ-CL-4`).
 */
export function kippu(): KippuClient {
  return createTRPCClient<AppRouter>({
    links: [httpLink({ url: `${apiUrl()}/v0/trpc` })],
  });
}

/** What the Kippu API's procedures answer. */
export type ApiOutputs = inferRouterOutputs<AppRouter>;

/** An event, as one object of ledger facts and platform metadata (`AC-A3.2`). */
export type EventView = NonNullable<ApiOutputs["derived"]["events"]["get"]["event"]>;

/** A page of the public index of events on sale. */
export type EventsOnSalePage = ApiOutputs["derived"]["events"]["onSale"];

/** What Ichiba can offer of an event: classes on sale, availability counting holds, free seats. */
export type SaleInventory = ApiOutputs["sales"]["inventory"];
