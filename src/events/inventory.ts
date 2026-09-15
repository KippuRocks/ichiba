import type { SaleInventory } from "../server/kippu.ts";
import { formatPrice } from "./price.ts";
import type { EventPresentation } from "./view.ts";

/** A class on sale, as the event page offers it. */
export interface ClassOffer {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  /** The price, written with the sale asset's precision. */
  readonly price: string;
  /** What the page says of how many are left. */
  readonly availability: string;
  readonly soldOut: boolean;
}

/** A seated zone, and how many of its seats can still be picked. */
export interface SeatOffer {
  readonly zone: string;
  readonly name: string | null;
  readonly availability: string;
  /** Whether any seat can be picked. */
  readonly free: boolean;
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
  const asset = inventory.asset;
  if (!inventory.onSale || asset === null || event.closed !== null) {
    return { onSale: false, classes: [], seats: [] };
  }
  const names = new Map(event.zones.map((zone) => [zone.id, zone.name]));
  return {
    onSale: true,
    classes: inventory.classes.map((offered) => ({
      id: offered.id,
      name: offered.name,
      description: offered.description,
      price: formatPrice(offered.price, asset),
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
              free: zone.freeSeats.length > 0,
            },
          ]
        : [],
    ),
  };
}

/** What picking a seat in a zone can come to (`US-B5`, `AC-B5.2`). */
export type SeatChoice =
  | { readonly kind: "none" }
  | { readonly kind: "selected"; readonly seat: string }
  | { readonly kind: "unavailable"; readonly seat: string };

/**
 * Checks a picked seat against the zone's free seats — canonical, neither issued
 * nor held — as the inventory reads them now. Only a free seat is selected; any
 * other, taken or held since the page was shown, or never a seat of the zone, is
 * refused with a reason the buyer can act on. The hold still decides (`AC-B4.4`).
 */
export function seatChoice(freeSeats: readonly string[], picked: string | null): SeatChoice {
  if (picked === null || picked === "") return { kind: "none" };
  return freeSeats.includes(picked)
    ? { kind: "selected", seat: picked }
    : { kind: "unavailable", seat: picked };
}
