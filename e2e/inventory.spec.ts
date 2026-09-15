import { expect, test } from "@playwright/test";
import { seedGala } from "./support/events";
import { placeHold } from "./support/kippu";
import { holderSession } from "./support/saifu";

test("REQ-HD-3: availability drops while a hold is open, and every class is labelled a primary sale (REQ-MP-1)", async ({
  browser,
  page,
}) => {
  const gala = await seedGala(browser, "Spring Concert");
  const purchasedClass = gala.purchasedClass as string;
  const [stalls, standing] = gala.zones;
  if (stalls === undefined || standing === undefined) throw new Error("zones not seeded");

  await page.goto(`/events/${gala.event}`);
  const tickets = page.getByRole("region", { name: "Tickets" });
  const general = tickets.getByRole("list", { name: "Ticket classes" }).getByRole("listitem");
  await expect(general).toHaveCount(1);
  await expect(general).toContainText("General");
  await expect(general).toContainText("Primary sale · sold by Gala Productions");
  await expect(general.getByTestId("class-availability")).toHaveText("500 left");
  const stallsSeats = tickets.getByRole("list", { name: "Seats" }).getByRole("listitem");
  await expect(stallsSeats).toHaveText("Stalls 3 seats free");

  // A buyer holds a standing place: one fewer can be held, while the hold is open.
  const buyer = await holderSession();
  const standingHold = await placeHold(buyer.token, {
    event: gala.event,
    zone: standing.id,
    class: purchasedClass,
  });
  expect(standingHold.outcome).toBe("held");
  await page.reload();
  await expect(general.getByTestId("class-availability")).toHaveText("499 left");
  await expect(stallsSeats).toHaveText("Stalls 3 seats free");

  // Another holds a seat: a place and a seat fewer.
  const other = await holderSession();
  const seatHold = await placeHold(other.token, {
    event: gala.event,
    zone: stalls.id,
    class: purchasedClass,
    seat: "A-2",
  });
  expect(seatHold.outcome).toBe("held");
  await page.reload();
  await expect(general.getByTestId("class-availability")).toHaveText("498 left");
  await expect(stallsSeats).toHaveText("Stalls 2 seats free");
});

test("an event with no Purchased class offers no tickets", async ({ browser, page }) => {
  const { event } = await seedGala(browser, "Private Rehearsal", { onSale: false });
  await page.goto(`/events/${event}`);
  const tickets = page.getByRole("region", { name: "Tickets" });
  await expect(tickets).toContainText("No tickets are on sale for this event yet.");
  await expect(page.locator("[data-sale]")).toHaveCount(0);
});
