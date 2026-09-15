import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EventIndex } from "../events/EventIndex.tsx";
import { present } from "../events/view.ts";
import { Screen } from "../screens/Screen.tsx";
import { ScreenLink } from "../screens/ScreenLink.tsx";
import { readEventsOnSale } from "../server/events.ts";

interface Props {
  readonly searchParams: Promise<{ readonly page?: string | string[] }>;
}

/**
 * The home page: the public index of events on sale, rendered on the server for
 * every request, with no session and no cookies (`REQ-MP-7`). Only `Active`
 * events with a `Purchased` class are listed; cancelled and finished events are
 * not.
 */
export default async function Home({ searchParams }: Props) {
  await connection();
  const { page } = await searchParams;
  const token = typeof page === "string" && page !== "" ? page : null;
  const index = await readEventsOnSale(token);
  if (index === null) notFound();
  return (
    <Screen id="home">
      <h1>Events on sale</h1>
      <EventIndex
        events={index.events.map(present)}
        link={(event, children) => (
          <ScreenLink
            from="home"
            to="event.detail"
            params={{ event: event.id }}
            className="event-summary"
          >
            {children}
          </ScreenLink>
        )}
      />
      {index.nextPage !== null && (
        <nav aria-label="More events">
          <ScreenLink from="home" to="home" params={{}} query={{ page: index.nextPage }}>
            More events
          </ScreenLink>
        </nav>
      )}
    </Screen>
  );
}
