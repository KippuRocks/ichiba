import type { ReactNode } from "react";
import type { EventPresentation } from "./view.ts";

/** One event in the index: its name, when and where, as its document says. */
export function EventSummary({ event }: { event: EventPresentation }) {
  const first = event.sessions[0];
  return (
    <>
      <span className="event-summary-name">{event.name ?? "Untitled event"}</span>
      {first !== undefined && <span className="event-summary-when">{first.when}</span>}
      {event.venue !== null && <span className="event-summary-venue">{event.venue.name}</span>}
    </>
  );
}

/**
 * The index of events on sale. `link` wraps each summary in a link to its event
 * page, so the navigation is declared where the screen renders it.
 */
export function EventIndex({
  events,
  link,
}: {
  events: readonly EventPresentation[];
  link: (event: EventPresentation, children: ReactNode) => ReactNode;
}) {
  if (events.length === 0) {
    return <p className="event-index-empty">No events are on sale right now.</p>;
  }
  return (
    <ul className="event-index" aria-label="Events on sale">
      {events.map((event) => (
        <li key={event.id}>{link(event, <EventSummary event={event} />)}</li>
      ))}
    </ul>
  );
}
