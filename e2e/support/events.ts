import type { Browser } from "@playwright/test";
import { addVirtualAuthenticator } from "./authenticator";
import { createEvent, type SeededEvent, signUpOrganiser } from "./kippu";

/**
 * An event with a seated and an unseated zone and a full public document, created
 * by a new organiser. With `onSale`, it also has a `Purchased` class priced
 * 45,000.00 COPM; with `saleAsset`, its prices are in COPM.
 */
export async function seedGala(
  browser: Browser,
  name = "Autumn Gala",
  {
    onSale = true,
    saleAsset = true,
  }: { readonly onSale?: boolean; readonly saleAsset?: boolean } = {},
): Promise<SeededEvent> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await addVirtualAuthenticator(page);
    const token = await signUpOrganiser(page);
    return await createEvent(token, {
      zones: [
        { name: "Stalls", kind: "Seated", seats: ["A-1", "A-2", "A-3", "A-4"] },
        { name: "Standing", kind: "Unseated" },
      ],
      capacity: 500,
      ...(onSale ? { purchasedClass: { name: "General", price: 4_500_000 } } : {}),
      ...(saleAsset ? { saleAsset: "COPM/2" as const } : {}),
      grantedClass: "Press",
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
