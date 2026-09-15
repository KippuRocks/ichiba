import type { Browser } from "@playwright/test";
import { addVirtualAuthenticator } from "./authenticator";
import { createEvent, type SeededEvent, signUpOrganiser } from "./kippu";

/** An event with a seated and an unseated zone and a full public document, created by a new organiser. */
export async function seedGala(browser: Browser, name = "Autumn Gala"): Promise<SeededEvent> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await addVirtualAuthenticator(page);
    const token = await signUpOrganiser(page);
    return await createEvent(token, {
      zones: [
        { name: "Stalls", kind: "Seated" },
        { name: "Standing", kind: "Unseated" },
      ],
      capacity: 500,
      document: (event, zones) => ({
        $schema: "https://meta.kippu.rocks/v0/schemas/event/1.0.json",
        eventId: event,
        name,
        description: "An evening of music.",
        organiser: { tradingName: "Gala Productions" },
        venue: { name: "Teatro Real", address: { locality: "Madrid", country: "ES" } },
        schedule: {
          timeZone: "Europe/Madrid",
          sessions: [{ startsAt: "2026-10-01T20:00:00+02:00" }],
        },
        zones: Object.fromEntries(zones.map((zone) => [zone.id, { name: zone.name }])),
      }),
    });
  } finally {
    await context.close();
  }
}
