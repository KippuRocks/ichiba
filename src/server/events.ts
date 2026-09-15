import { TRPCClientError } from "@trpc/client";
import { cache } from "react";
import { type EventsOnSalePage, type EventView, kippu } from "./kippu.ts";

const EVENT_ID = /^[0-9a-f]{64}$/;

/**
 * An event from Kippu's derived copy, joined with its public document, as one
 * object (`AC-A3.2`). Public: the call carries no session (`REQ-MP-7`). `null`
 * when the id is not an event id, or the copy holds no such event. Cached per
 * request, so a page and its metadata read the API once.
 */
export const readEvent = cache(async (event: string): Promise<EventView | null> => {
  if (!EVENT_ID.test(event)) return null;
  const read = await kippu().derived.events.get.query({ event });
  return read.event;
});

/** How many events a page of the home page's index shows. */
export const INDEX_PAGE_SIZE = 20;

/**
 * A page of the public index of events on sale — `Active`, with a `Purchased`
 * class — most recently created first, from Kippu's derived copy. Public: the
 * call carries no session (`REQ-MP-7`). `null` when `page` is a token the API
 * refuses.
 */
export async function readEventsOnSale(page: string | null): Promise<EventsOnSalePage | null> {
  try {
    return await kippu().derived.events.onSale.query({ limit: INDEX_PAGE_SIZE, page });
  } catch (error) {
    if (page !== null && error instanceof TRPCClientError && error.data?.code === "BAD_REQUEST") {
      return null;
    }
    throw error;
  }
}
