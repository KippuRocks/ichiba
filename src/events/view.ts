import type { EventView } from "../server/kippu.ts";

/** What an event page shows, read from the ledger facts and the event's document. */
export interface EventPresentation {
  readonly id: string;
  /** The document's name; `null` when the event has no readable document. */
  readonly name: string | null;
  readonly description: string | null;
  readonly organiser: string | null;
  readonly venue: { readonly name: string; readonly address: string | null } | null;
  readonly sessions: readonly { readonly name: string | null; readonly when: string }[];
  readonly image: { readonly url: string; readonly alt: string } | null;
  readonly zones: readonly {
    readonly id: string;
    readonly name: string | null;
    readonly kind: "Seated" | "Unseated";
  }[];
  readonly status: EventView["status"];
  /** Why nothing is for sale, when the event's status rules sales out. */
  readonly closed: "cancelled" | "finished" | null;
}

function field(object: unknown, key: string): unknown {
  return typeof object === "object" && object !== null && !Array.isArray(object)
    ? (object as Record<string, unknown>)[key]
    : undefined;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** A session's start, in the event's own time zone when the document names a valid one. */
export function formatWhen(startsAt: string, timeZone: string | null): string | null {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timeZone ?? "UTC" }).format(
      date,
    );
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(date);
  }
}

export function present(event: EventView): EventPresentation {
  const document: unknown = event.metadata;
  const venue = field(document, "venue");
  const address = field(venue, "address");
  const schedule = field(document, "schedule");
  const timeZone = text(field(schedule, "timeZone"));
  const sessions = field(schedule, "sessions");
  const imagery = field(document, "imagery");
  const firstImage = Array.isArray(imagery) ? imagery[0] : undefined;
  const zoneNames = field(document, "zones");
  const venueName = text(field(venue, "name"));
  const addressLine = [
    field(address, "streetAddress"),
    field(address, "locality"),
    field(address, "region"),
    field(address, "postalCode"),
    field(address, "country"),
  ]
    .map(text)
    .filter((part): part is string => part !== null)
    .join(", ");

  return {
    id: event.id,
    name: text(field(document, "name")),
    description: text(field(document, "description")),
    organiser: text(field(field(document, "organiser"), "tradingName")),
    venue: venueName === null ? null : { name: venueName, address: addressLine || null },
    sessions: (Array.isArray(sessions) ? sessions : []).flatMap((session: unknown) => {
      const startsAt = text(field(session, "startsAt"));
      const when = startsAt === null ? null : formatWhen(startsAt, timeZone);
      return when === null ? [] : [{ name: text(field(session, "name")), when }];
    }),
    image:
      text(field(firstImage, "url")) === null
        ? null
        : {
            url: field(firstImage, "url") as string,
            alt: text(field(firstImage, "alt")) ?? "",
          },
    zones: event.zones.map((zone) => ({
      id: zone.id,
      name: text(field(field(zoneNames, zone.id), "name")),
      kind: zone.kind,
    })),
    status: event.status,
    closed:
      event.status === "Cancelled" ? "cancelled" : event.status === "Finished" ? "finished" : null,
  };
}
