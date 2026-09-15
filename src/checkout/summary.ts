import { formatPrice, type SaleAsset } from "../events/price.ts";
import type { EventPresentation } from "../events/view.ts";
import type { Checkout } from "../server/checkout.ts";
import type { SaleInventory } from "../server/kippu.ts";

/** What is being bought, as the checkout screens name it. */
export interface CheckoutSummary {
  readonly event: string;
  readonly eventName: string;
  readonly zoneName: string;
  readonly seat: string | null;
  readonly className: string;
  /** The price the hold was placed at, or the class's price before a hold. `null` when unknown. */
  readonly price: string | null;
}

const ASSETS: readonly string[] = ["COPM/2", "DUSD/6"];

export function priceOf(amount: number | null, asset: string | null): string | null {
  if (amount === null || asset === null || !ASSETS.includes(asset)) return null;
  return formatPrice(amount, asset as SaleAsset);
}

export function summaryOf(
  checkout: Checkout,
  event: EventPresentation | null,
  inventory: SaleInventory | null,
): CheckoutSummary {
  const offered = inventory?.classes.find((candidate) => candidate.id === checkout.class);
  const held = checkout.hold === null ? null : priceOf(checkout.hold.price, checkout.hold.asset);
  return {
    event: checkout.event,
    eventName: event?.name ?? "Untitled event",
    zoneName: event?.zones.find((zone) => zone.id === checkout.zone)?.name ?? "Unnamed zone",
    seat: checkout.placement.kind === "Seated" ? checkout.placement.position : null,
    className: offered?.name ?? "Ticket",
    price: held ?? priceOf(offered?.price ?? null, inventory?.asset ?? null),
  };
}

/** Whole minutes left before `expiresAt`, never below zero. */
export function minutesLeft(expiresAt: string, now: Date): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 60_000));
}
