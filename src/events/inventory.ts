import type { SaleInventory } from "../server/kippu.ts";
import type { EventPresentation } from "./view.ts";

/** A class on sale, as the event page offers it. */
export interface ClassOffer {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  /** What the page says of how many are left. */
  readonly availability: string;
  readonly soldOut: boolean;
}

/** A seated zone, and how many of its seats can still be picked. */
export interface SeatOffer {
  readonly zone: string;
  readonly name: string | null;
  readonly availability: string;
}

export interface Offer {
  /** `false` when the event is not on sale: nothing is offered. */
  readonly onSale: boolean;
  readonly classes: readonly ClassOffer[];
  readonly seats: readonly SeatOffer[];
}

/** How many are left, counting outstanding holds (`REQ-HD-3`); `null` is unbounded. */
export function availabilityOf(available: number | null): string {
  if (available === null) return "Available";
  if (available <= 0) return "Sold out";
  return `${available} left`;
}

function seatsOf(free: number): string {
  if (free === 0) return "No seats free";
  return free === 1 ? "1 seat free" : `${free} seats free`;
}

/** The offer an event page shows, from the sale inventory and the event's presentation. */
export function offerOf(inventory: SaleInventory, event: EventPresentation): Offer {
  if (!inventory.onSale || event.closed !== null) {
    return { onSale: false, classes: [], seats: [] };
  }
  const names = new Map(event.zones.map((zone) => [zone.id, zone.name]));
  return {
    onSale: true,
    classes: inventory.classes.map((offered) => ({
      id: offered.id,
      name: offered.name,
      description: offered.description,
      availability: availabilityOf(offered.available),
      soldOut: offered.available !== null && offered.available <= 0,
    })),
    seats: inventory.zones.flatMap((zone) =>
      zone.kind === "Seated"
        ? [
            {
              zone: zone.id,
              name: names.get(zone.id) ?? null,
              availability: seatsOf(zone.freeSeats.length),
            },
          ]
        : [],
    ),
  };
}
