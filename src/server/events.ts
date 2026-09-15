import { cache } from "react";
import { type EventView, kippu } from "./kippu.ts";

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
