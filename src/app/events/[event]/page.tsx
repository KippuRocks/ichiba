import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventDetails } from "../../../events/EventDetails.tsx";
import { present } from "../../../events/view.ts";
import { Screen } from "../../../screens/Screen.tsx";
import { readEvent } from "../../../server/events.ts";

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
 * copy, with no session and no cookies (`REQ-MP-7`).
 */
export default async function EventPage({ params }: Props) {
  await connection();
  const view = await readEvent((await params).event);
  if (view === null) notFound();
  return (
    <Screen id="event.detail">
      <EventDetails event={present(view)} />
    </Screen>
  );
}
