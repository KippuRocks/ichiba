import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SaleInventory } from "../server/kippu.ts";
import { Inventory } from "./Inventory.tsx";
import { availabilityOf, offerOf } from "./inventory.ts";
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

describe("the inventory an event page offers", () => {
  it("REQ-HD-3: says how many are left, as the inventory counts them with holds", () => {
    expect(availabilityOf(12)).toBe("12 left");
    expect(availabilityOf(1)).toBe("1 left");
    expect(availabilityOf(0)).toBe("Sold out");
    expect(availabilityOf(null)).toBe("Available");
  });

  it("REQ-MP-1: labels every class for sale as a primary sale by the organiser", () => {
    const html = renderToStaticMarkup(
      <Inventory offer={offerOf(inventory, event)} seller={event.organiser} />,
    );
    expect(html.match(/data-sale="primary"/g)).toHaveLength(3);
    expect(html).toContain("Primary sale · sold by Gala Productions");
    expect(html).toContain("12 left");
    expect(html).toContain("Sold out");
    expect(html).toContain('Stalls</span> <span data-testid="zone-seats">2 seats free');
    expect(
      renderToStaticMarkup(<Inventory offer={offerOf(inventory, event)} seller={null} />),
    ).toContain("Primary sale · sold by the organiser");
  });

  it("offers nothing when the event is not on sale", () => {
    for (const offer of [
      offerOf({ ...inventory, onSale: false, classes: [], zones: [] }, event),
      offerOf(inventory, { ...event, status: "Cancelled", closed: "cancelled" }),
    ]) {
      expect(offer).toEqual({ onSale: false, classes: [], seats: [] });
      const html = renderToStaticMarkup(<Inventory offer={offer} seller={null} />);
      expect(html).toContain("Tickets are not on sale for this event.");
      expect(html).not.toContain("data-sale");
    }
  });
});
