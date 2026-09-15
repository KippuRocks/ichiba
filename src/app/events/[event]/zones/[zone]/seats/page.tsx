import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BuyForm } from "../../../../../../checkout/BuyForm.tsx";
import { offerOf, seatChoice } from "../../../../../../events/inventory.ts";
import { SeatPicker } from "../../../../../../events/SeatPicker.tsx";
import { present, seatMapsOf } from "../../../../../../events/view.ts";
import { Screen } from "../../../../../../screens/Screen.tsx";
import { ScreenLink } from "../../../../../../screens/ScreenLink.tsx";
import { readEvent, readInventory } from "../../../../../../server/events.ts";
import { buySeat } from "../../../../../checkout/actions.ts";

interface Props {
  readonly params: Promise<{ readonly event: string; readonly zone: string }>;
  readonly searchParams: Promise<{ readonly seat?: string | string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await connection();
  const view = await readEvent((await params).event);
  const name = view === null ? null : present(view).name;
  return { title: name === null ? "Choose a seat" : `Choose a seat · ${name}` };
}

/**
 * Seat selection in one seated zone of an event, rendered on the server for
 * every request from the sale inventory, with no session (`REQ-MP-7`): only the
 * zone's free seats are offered (`US-B5`).
 */
export default async function SeatsPage({ params, searchParams }: Props) {
  await connection();
  const { event, zone } = await params;
  const view = await readEvent(event);
  const zoneFact = view?.zones.find((candidate) => candidate.id === zone);
  if (view === null || zoneFact?.kind !== "Seated") notFound();
  const presented = present(view);
  const inventory = presented.closed === null ? await readInventory(event) : null;
  const onSale = inventory?.zones.find((candidate) => candidate.id === zone);
  const { seat } = await searchParams;
  const choice = seatChoice(
    onSale?.kind === "Seated" ? onSale.freeSeats : [],
    typeof seat === "string" ? seat : null,
  );
  const zoneName = presented.zones.find((candidate) => candidate.id === zone)?.name ?? null;

  return (
    <Screen id="event.seats">
      <p>
        <ScreenLink from="event.seats" to="event.detail" params={{ event }}>
          Back to {presented.name ?? "the event"}
        </ScreenLink>
      </p>
      <h1>Choose a seat</h1>
      {inventory === null || !inventory.onSale || onSale?.kind !== "Seated" ? (
        <p>Tickets are not on sale for this event.</p>
      ) : (
        <SeatPicker
          zoneName={zoneName}
          seatMaps={seatMapsOf(presented, zone)}
          freeSeats={onSale.freeSeats}
          choice={choice}
          buy={
            choice.kind === "selected" ? (
              <BuyForm
                action={buySeat}
                event={event}
                zone={zone}
                seat={choice.seat}
                classes={offerOf(inventory, presented).classes}
                label="Buy this seat"
              />
            ) : null
          }
        />
      )}
    </Screen>
  );
}
