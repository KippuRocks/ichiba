import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventDetails } from "../../../events/EventDetails.tsx";
import { Inventory } from "../../../events/Inventory.tsx";
import { offerOf } from "../../../events/inventory.ts";
import { present } from "../../../events/view.ts";
import { Screen } from "../../../screens/Screen.tsx";
import { readEvent, readInventory } from "../../../server/events.ts";

interface Props {
  readonly params: Promise<{ readonly event: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const view = await readEvent((await params).event);
  const name = view === null ? null : present(view).name;
  return { title: name ?? "Event" };
}

/**
 * An event page, rendered on the server for every request from Kippu's derived
 * copy, with no session and no cookies (`REQ-MP-7`): the event, and what is on
 * sale of it, with availability read fresh for the request.
 */
export default async function EventPage({ params }: Props) {
  await connection();
  const { event } = await params;
  const view = await readEvent(event);
  if (view === null) notFound();
  const presented = present(view);
  const inventory = presented.closed === null ? await readInventory(event) : null;
  return (
    <Screen id="event.detail">
      <EventDetails event={presented} />
      {inventory !== null && (
        <Inventory offer={offerOf(inventory, presented)} seller={presented.organiser} />
      )}
    </Screen>
  );
}
