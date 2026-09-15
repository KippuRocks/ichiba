import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EventView } from "../server/kippu.ts";
import { EventDetails } from "./EventDetails.tsx";
import { formatWhen, present, seatMapsOf } from "./view.ts";

const ID = "ab".repeat(32);
const STALLS = "01".repeat(32);
const STANDING = "02".repeat(32);

function event(overrides: Partial<EventView> = {}): EventView {
  return {
    authoritative: false,
    sequence: 7,
    id: ID,
    owner: "cd".repeat(32),
    status: "Active",
    maxCapacity: 500,
    issued: 3,
    passWindow: { windowMs: 60_000, isDefault: true },
    zones: [
      { id: STALLS, kind: "Seated" },
      { id: STANDING, kind: "Unseated" },
    ],
    metadataLocator: `https://meta.kippu.rocks/v0/events/${ID}.json`,
    metadata: {
      $schema: "https://meta.kippu.rocks/v0/schemas/event/1.0.json",
      eventId: ID,
      name: "Autumn Gala",
      description: "An evening of music.",
      organiser: { tradingName: "Gala Productions" },
      venue: { name: "Teatro Real", address: { locality: "Madrid", country: "ES" } },
      schedule: {
        timeZone: "Europe/Madrid",
        sessions: [{ startsAt: "2026-10-01T20:00:00+02:00" }],
      },
      imagery: [{ url: "https://meta.kippu.rocks/v0/images/gala.webp", alt: "The stage" }],
      seatMaps: [
        { url: "https://meta.kippu.rocks/v0/images/stalls.png", zones: [STALLS] },
        { url: "https://meta.kippu.rocks/v0/images/venue.png" },
      ],
      zones: { [STALLS]: { name: "Stalls" } },
    },
    ...overrides,
  };
}

describe("an event page", () => {
  it("AC-A3.2: presents ledger facts and the event's document as one object", () => {
    const presented = present(event());
    expect(presented).toEqual({
      id: ID,
      name: "Autumn Gala",
      description: "An evening of music.",
      organiser: "Gala Productions",
      venue: { name: "Teatro Real", address: "Madrid, ES" },
      sessions: [{ name: null, when: formatWhen("2026-10-01T20:00:00+02:00", "Europe/Madrid") }],
      image: { url: "https://meta.kippu.rocks/v0/images/gala.webp", alt: "The stage" },
      seatMaps: [
        { url: "https://meta.kippu.rocks/v0/images/stalls.png", zones: [STALLS] },
        { url: "https://meta.kippu.rocks/v0/images/venue.png", zones: null },
      ],
      zones: [
        { id: STALLS, name: "Stalls", kind: "Seated" },
        { id: STANDING, name: null, kind: "Unseated" },
      ],
      status: "Active",
      closed: null,
    });
    const html = renderToStaticMarkup(<EventDetails event={presented} />);
    expect(html).toContain("<h1>Autumn Gala</h1>");
    expect(html).toContain("Teatro Real");
    expect(html).not.toContain('data-testid="event-closed"');
  });

  it("finds the seat maps that show a zone", () => {
    const presented = present(event());
    expect(seatMapsOf(presented, STALLS)).toEqual([
      "https://meta.kippu.rocks/v0/images/stalls.png",
      "https://meta.kippu.rocks/v0/images/venue.png",
    ]);
    expect(seatMapsOf(presented, STANDING)).toEqual([
      "https://meta.kippu.rocks/v0/images/venue.png",
    ]);
  });

  it("shows a session's start in the event's time zone", () => {
    expect(formatWhen("2026-10-01T20:00:00+02:00", "Europe/Madrid")).toMatch(/20:00/);
    expect(formatWhen("2026-10-01T20:00:00+02:00", "Not/AZone")).toMatch(/18:00/);
    expect(formatWhen("not a date", null)).toBeNull();
  });

  it("describes an event from its ledger facts alone when it has no document", () => {
    const presented = present(event({ metadata: null }));
    expect(presented.name).toBeNull();
    expect(presented.zones.map((zone) => zone.kind)).toEqual(["Seated", "Unseated"]);
    const html = renderToStaticMarkup(<EventDetails event={presented} />);
    expect(html).toContain("<h1>Untitled event</h1>");
    expect(html).toContain("General admission");
  });

  it.each([
    ["Cancelled", "This event has been cancelled. Nothing is for sale."],
    ["Finished", "This event has finished. Nothing is for sale."],
  ] as const)("shows a %s event as such, offering nothing for sale", (status, notice) => {
    const html = renderToStaticMarkup(<EventDetails event={present(event({ status }))} />);
    expect(html).toContain(notice);
  });
});
