import type { ReactNode } from "react";
import type { Offer, SeatOffer } from "./inventory.ts";
import { SaleLabel } from "./SaleLabel.tsx";

/**
 * The tickets an event page offers: each `Purchased` class, labelled as a
 * primary sale by the organiser (`REQ-MP-1`), with how many are left counting
 * outstanding holds (`REQ-HD-3`), and the free seats of each seated zone.
 */
export function Inventory({
  offer,
  seller,
  seatLink,
}: {
  offer: Offer;
  seller: string | null;
  /** A link to pick a seat in a seated zone with free seats. */
  seatLink: (zone: SeatOffer, children: ReactNode) => ReactNode;
}) {
  if (!offer.onSale) {
    return (
      <section aria-labelledby="tickets-heading" className="inventory">
        <h2 id="tickets-heading">Tickets</h2>
        <p>Tickets are not on sale for this event.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="tickets-heading" className="inventory">
      <h2 id="tickets-heading">Tickets</h2>
      {offer.classes.length === 0 ? (
        <p>No tickets are on sale for this event yet.</p>
      ) : (
        <ul className="inventory-classes" aria-label="Ticket classes">
          {offer.classes.map((offered) => (
            <li key={offered.id} data-sold-out={offered.soldOut}>
              <span className="inventory-class-name">{offered.name}</span>
              <SaleLabel kind="primary" seller={seller} />
              {offered.description !== null && (
                <span className="inventory-class-description">{offered.description}</span>
              )}
              <span className="inventory-availability" data-testid="class-availability">
                {offered.availability}
              </span>
            </li>
          ))}
        </ul>
      )}
      {offer.seats.length > 0 && (
        <ul className="inventory-seats" aria-label="Seats">
          {offer.seats.map((zone) => (
            <li key={zone.zone}>
              <span className="inventory-zone-name">{zone.name ?? "Unnamed zone"}</span>{" "}
              <span data-testid="zone-seats">{zone.availability}</span>
              {zone.free && <> {seatLink(zone, "Choose a seat")}</>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
