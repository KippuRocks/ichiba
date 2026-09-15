import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SaleInventory } from "../server/kippu.ts";
import { Inventory } from "./Inventory.tsx";
import { availabilityOf, offerOf, type SeatOffer, seatChoice } from "./inventory.ts";
import { SeatPicker } from "./SeatPicker.tsx";
import type { EventPresentation } from "./view.ts";

const STALLS = "01".repeat(32);
const STANDING = "02".repeat(32);

const event: EventPresentation = {
  id: "ab".repeat(32),
  name: "Autumn Gala",
  description: null,
  organiser: "Gala Productions",
  venue: null,
  sessions: [],
  image: null,
  seatMaps: [],
  zones: [
    { id: STALLS, name: "Stalls", kind: "Seated" },
    { id: STANDING, name: "Standing", kind: "Unseated" },
  ],
  status: "Active",
  closed: null,
};

const inventory: SaleInventory = {
  event: event.id,
  onSale: true,
  available: 12,
  classes: [
    {
      id: "c1".repeat(32),
      name: "General",
      description: null,
      policy: { kind: "Single" },
      available: 12,
    },
    {
      id: "c2".repeat(32),
      name: "Early bird",
      description: "The first ten.",
      policy: { kind: "Single" },
      available: 0,
    },
    {
      id: "c3".repeat(32),
      name: "Open",
      description: null,
      policy: { kind: "Single" },
      available: null,
    },
  ],
  zones: [
    { id: STALLS, kind: "Seated", freeSeats: ["A-1", "A-2"] },
    { id: STANDING, kind: "Unseated" },
  ],
};

const link = (zone: SeatOffer, children: ReactNode) => <a href={`#${zone.zone}`}>{children}</a>;

describe("the inventory an event page offers", () => {
  it("REQ-HD-3: says how many are left, as the inventory counts them with holds", () => {
    expect(availabilityOf(12)).toBe("12 left");
    expect(availabilityOf(1)).toBe("1 left");
    expect(availabilityOf(0)).toBe("Sold out");
    expect(availabilityOf(null)).toBe("Available");
  });

  it("REQ-MP-1: labels every class for sale as a primary sale by the organiser", () => {
    const html = renderToStaticMarkup(
      <Inventory offer={offerOf(inventory, event)} seller={event.organiser} seatLink={link} />,
    );
    expect(html.match(/data-sale="primary"/g)).toHaveLength(3);
    expect(html).toContain("Primary sale · sold by Gala Productions");
    expect(html).toContain("12 left");
    expect(html).toContain("Sold out");
    expect(html).toContain('Stalls</span> <span data-testid="zone-seats">2 seats free');
    expect(
      renderToStaticMarkup(
        <Inventory offer={offerOf(inventory, event)} seller={null} seatLink={link} />,
      ),
    ).toContain("Primary sale · sold by the organiser");
  });

  it("offers nothing when the event is not on sale", () => {
    for (const offer of [
      offerOf({ ...inventory, onSale: false, classes: [], zones: [] }, event),
      offerOf(inventory, { ...event, status: "Cancelled", closed: "cancelled" }),
    ]) {
      expect(offer).toEqual({ onSale: false, classes: [], seats: [] });
      const html = renderToStaticMarkup(<Inventory offer={offer} seller={null} seatLink={link} />);
      expect(html).toContain("Tickets are not on sale for this event.");
      expect(html).not.toContain("data-sale");
    }
  });
});

describe("picking a seat", () => {
  const free = ["A-1", "A-3"];

  it("US-B5: selects only a free seat", () => {
    expect(seatChoice(free, "A-1")).toEqual({ kind: "selected", seat: "A-1" });
    expect(seatChoice(free, null)).toEqual({ kind: "none" });
    expect(seatChoice(free, "")).toEqual({ kind: "none" });
  });

  it("AC-B5.2: refuses a seat that is taken, held, or not a seat of the zone", () => {
    expect(seatChoice(free, "A-2")).toEqual({ kind: "unavailable", seat: "A-2" });
    expect(seatChoice(free, "Z-99")).toEqual({ kind: "unavailable", seat: "Z-99" });
    expect(seatChoice(free, "a-1")).toEqual({ kind: "unavailable", seat: "a-1" });
  });
});

describe("the seat picker", () => {
  it("US-B5: shows the zone's seat maps and offers only its free seats", () => {
    const html = renderToStaticMarkup(
      <SeatPicker
        zoneName="Stalls"
        seatMaps={["https://meta.kippu.rocks/v0/images/stalls.png"]}
        freeSeats={["A-1", "A-3"]}
        choice={{ kind: "selected", seat: "A-3" }}
      />,
    );
    expect(html).toContain('src="https://meta.kippu.rocks/v0/images/stalls.png"');
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).not.toContain('value="A-2"');
    expect(html).toContain('<strong data-testid="selected-seat">A-3</strong>');
  });

  it("AC-B5.2: explains why a seat asked for cannot be selected", () => {
    const html = renderToStaticMarkup(
      <SeatPicker
        zoneName="Stalls"
        seatMaps={[]}
        freeSeats={[]}
        choice={{ kind: "unavailable", seat: "A-2" }}
      />,
    );
    expect(html).toContain("Seat A-2 can&#x27;t be selected");
    expect(html).toContain("No seats are free in Stalls.");
    expect(html).not.toContain("selected-seat");
  });
});
