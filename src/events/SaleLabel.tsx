/**
 * Says what kind of sale an item is, on every item for sale (`REQ-MP-1`). In V0
 * every item is a primary sale by the organiser; resale labels will stand beside
 * this one when the secondary market ships.
 */
export function SaleLabel({ kind, seller }: { kind: "primary"; seller: string | null }) {
  return (
    <span className="sale-label" data-sale={kind}>
      Primary sale · sold by {seller ?? "the organiser"}
    </span>
  );
}
