import type { ReactNode } from "react";
import type { SeatChoice } from "./inventory.ts";

/**
 * Seat selection in a seated zone (`US-B5`): the organiser's seat maps, and a
 * choice among the zone's free seats only — canonical, neither issued nor held
 * (`REQ-HD-3`). A seat that is not free is never offered, and one asked for
 * anyway is refused with a reason (`AC-B5.2`). Submitting asks the server again,
 * so the choice is checked against the seats free at that moment.
 */
export function SeatPicker({
  zoneName,
  seatMaps,
  freeSeats,
  choice,
  buy = null,
}: {
  zoneName: string | null;
  seatMaps: readonly string[];
  freeSeats: readonly string[];
  choice: SeatChoice;
  /** How to buy the selected seat. */
  buy?: ReactNode;
}) {
  const zone = zoneName ?? "this zone";
  return (
    <section className="seat-picker" aria-labelledby="seats-heading">
      <h2 id="seats-heading">Seats in {zone}</h2>
      {seatMaps.map((url) => (
        // The organiser's seat map is served from the metadata origin, not by Ichiba.
        // biome-ignore lint/performance/noImgElement: no image optimisation for another origin.
        <img key={url} className="seat-map" src={url} alt={`Seat map of ${zone}`} />
      ))}
      {choice.kind === "unavailable" && (
        <p className="seat-refused" role="alert">
          Seat {choice.seat} can't be selected: it has been taken or is being bought by someone
          else, or it is not a seat in {zone}. Choose one of the free seats below.
        </p>
      )}
      {choice.kind === "selected" && (
        <p className="seat-selected" role="status">
          Selected seat: <strong data-testid="selected-seat">{choice.seat}</strong>. It is held for
          you only once checkout starts.
        </p>
      )}
      {choice.kind === "selected" && buy}
      {freeSeats.length === 0 ? (
        <p>No seats are free in {zone}.</p>
      ) : (
        <form method="get" className="seat-form">
          <fieldset>
            <legend>Free seats</legend>
            <div className="seat-options">
              {freeSeats.map((seat) => (
                <label key={seat} className="seat-option">
                  <input
                    type="radio"
                    name="seat"
                    value={seat}
                    defaultChecked={choice.kind === "selected" && choice.seat === seat}
                    required
                  />
                  {seat}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit">Select seat</button>
        </form>
      )}
    </section>
  );
}
