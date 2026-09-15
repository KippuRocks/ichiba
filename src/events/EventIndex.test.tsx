import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventIndex } from "./EventIndex.tsx";
import type { EventPresentation } from "./view.ts";

const event: EventPresentation = {
  id: "ab".repeat(32),
  name: "Autumn Gala",
  description: null,
  organiser: null,
  venue: { name: "Teatro Real", address: null },
  sessions: [{ name: null, when: "Thursday, 1 October 2026 at 20:00 CEST" }],
  image: null,
  seatMaps: [],
  zones: [],
  status: "Active",
  closed: null,
};

describe("the index of events on sale", () => {
  it("links each event, with when and where it is", () => {
    const html = renderToStaticMarkup(
      <EventIndex
        events={[event, { ...event, id: "cd".repeat(32), name: null, venue: null, sessions: [] }]}
        link={(item, children) => <a href={`/events/${item.id}`}>{children}</a>}
      />,
    );
    expect(html).toContain(`href="/events/${"ab".repeat(32)}"`);
    expect(html).toContain("Autumn Gala");
    expect(html).toContain("Teatro Real");
    expect(html).toContain("Thursday, 1 October 2026 at 20:00 CEST");
    expect(html).toContain("Untitled event");
  });

  it("says so when nothing is on sale", () => {
    const html = renderToStaticMarkup(<EventIndex events={[]} link={() => null} />);
    expect(html).toContain("No events are on sale right now.");
  });
});
