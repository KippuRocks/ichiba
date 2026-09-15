import type { ClassOffer } from "../events/inventory.ts";

/**
 * Starts a checkout for a ticket of one of the classes on sale, in one zone —
 * and, in a seated zone, for one seat. `action` is the server action that
 * begins it. Only classes with tickets left can be picked.
 */
export function BuyForm({
  action,
  event,
  zone,
  seat,
  classes,
  label,
}: {
  action: (form: FormData) => Promise<void>;
  event: string;
  zone: string;
  seat?: string;
  classes: readonly ClassOffer[];
  label: string;
}) {
  const available = classes.filter((offered) => !offered.soldOut);
  if (available.length === 0) return <p>No tickets are left.</p>;
  return (
    <form action={action} className="buy-form">
      <input type="hidden" name="event" value={event} />
      <input type="hidden" name="zone" value={zone} />
      {seat !== undefined && <input type="hidden" name="seat" value={seat} />}
      <label>
        Ticket{" "}
        <select name="class" defaultValue={available[0]?.id}>
          {available.map((offered) => (
            <option key={offered.id} value={offered.id}>
              {offered.name} · {offered.price}
            </option>
          ))}
        </select>
      </label>{" "}
      <button type="submit">{label}</button>
    </form>
  );
}
