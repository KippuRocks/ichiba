import type { EventPresentation } from "./view.ts";

const CLOSED_NOTICE = {
  cancelled: "This event has been cancelled. Nothing is for sale.",
  finished: "This event has finished. Nothing is for sale.",
} as const;

/**
 * An event page's content: the event's ledger facts and its public document,
 * presented as one (`AC-A3.2`). When the event has no readable document, the
 * ledger facts alone still describe it.
 */
export function EventDetails({ event }: { event: EventPresentation }) {
  return (
    <article className="event">
      {event.image !== null && (
        // The document's image is served from the metadata origin, not by Ichiba.
        // biome-ignore lint/performance/noImgElement: no image optimisation for another origin.
        <img className="event-image" src={event.image.url} alt={event.image.alt} />
      )}
      <h1>{event.name ?? "Untitled event"}</h1>
      {event.closed !== null && (
        <p className="event-closed" role="status" data-testid="event-closed">
          {CLOSED_NOTICE[event.closed]}
        </p>
      )}
      {event.organiser !== null && <p className="event-organiser">By {event.organiser}</p>}
      {(event.venue !== null || event.sessions.length > 0) && (
        <dl className="event-facts">
          {event.venue !== null && (
            <>
              <dt>Venue</dt>
              <dd>
                {event.venue.name}
                {event.venue.address !== null && (
                  <span className="event-address">{event.venue.address}</span>
                )}
              </dd>
            </>
          )}
          {event.sessions.length > 0 && (
            <>
              <dt>When</dt>
              {event.sessions.map((session) => (
                <dd key={`${session.name ?? ""}${session.when}`}>
                  {session.name !== null ? `${session.name}: ${session.when}` : session.when}
                </dd>
              ))}
            </>
          )}
        </dl>
      )}
      {event.description !== null && <p className="event-description">{event.description}</p>}
      {event.zones.length > 0 && (
        <section aria-labelledby="zones-heading">
          <h2 id="zones-heading">Zones</h2>
          <ul className="event-zones">
            {event.zones.map((zone) => (
              <li key={zone.id}>
                {zone.name ?? "Unnamed zone"}{" "}
                <span className="zone-kind">
                  {zone.kind === "Seated" ? "Seated" : "General admission"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
