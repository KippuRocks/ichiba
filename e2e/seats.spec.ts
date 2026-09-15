import { expect, test } from "@playwright/test";
import { seedGala } from "./support/events";
import { issueGrantedSeat, placeHold } from "./support/kippu";
import { holderSession } from "./support/saifu";

test("US-B5 AC-B5.2: a taken or held seat cannot be selected", async ({ browser, page }) => {
  const gala = await seedGala(browser, "Seated Recital");
  const [stalls] = gala.zones;
  if (stalls === undefined) throw new Error("zones not seeded");

  // A-2 is held by a buyer at checkout; A-3 is issued to a guest.
  const buyer = await holderSession();
  const held = await placeHold(buyer.token, {
    event: gala.event,
    zone: stalls.id,
    class: gala.purchasedClass as string,
    seat: "A-2",
  });
  expect(held.outcome).toBe("held");
  await issueGrantedSeat(gala, stalls.id, "A-3");

  await page.goto(`/events/${gala.event}`);
  const seats = page.getByRole("list", { name: "Seats" }).getByRole("listitem");
  await expect(seats.getByTestId("zone-seats")).toHaveText("2 seats free");
  await seats.getByRole("link", { name: "Choose a seat" }).click();

  const screen = page.locator('[data-screen="event.seats"]');
  await expect(screen).toBeVisible();
  await expect(page).toHaveURL(`/events/${gala.event}/zones/${stalls.id}/seats`);
  // Only the free seats are offered: neither the held nor the issued one.
  const options = screen.getByRole("group", { name: "Free seats" }).getByRole("radio");
  await expect(options).toHaveCount(2);
  await expect(screen.getByRole("radio", { name: "A-1" })).toBeVisible();
  await expect(screen.getByRole("radio", { name: "A-4" })).toBeVisible();
  await expect(screen.getByRole("radio", { name: "A-2" })).toHaveCount(0);
  await expect(screen.getByRole("radio", { name: "A-3" })).toHaveCount(0);

  await screen.getByRole("radio", { name: "A-4" }).check();
  await screen.getByRole("button", { name: "Select seat" }).click();
  await expect(screen.getByTestId("selected-seat")).toHaveText("A-4");
  await expect(screen.getByRole("radio", { name: "A-4" })).toBeChecked();

  // Asked for anyway, a held, an issued or a non-canonical seat is refused, with a reason.
  for (const seat of ["A-2", "A-3", "Z-99"]) {
    await page.goto(`/events/${gala.event}/zones/${stalls.id}/seats?seat=${seat}`);
    await expect(screen.getByRole("alert")).toContainText(`Seat ${seat} can't be selected`);
    await expect(screen.getByTestId("selected-seat")).toHaveCount(0);
  }

  // A seat that is picked, then taken before it is submitted, is refused on submission.
  await page.goto(`/events/${gala.event}/zones/${stalls.id}/seats`);
  await screen.getByRole("radio", { name: "A-1" }).check();
  const other = await holderSession();
  expect(
    (
      await placeHold(other.token, {
        event: gala.event,
        zone: stalls.id,
        class: gala.purchasedClass as string,
        seat: "A-1",
      })
    ).outcome,
  ).toBe("held");
  await screen.getByRole("button", { name: "Select seat" }).click();
  await expect(screen.getByRole("alert")).toContainText("Seat A-1 can't be selected");
  await expect(screen.getByTestId("selected-seat")).toHaveCount(0);
  await expect(screen.getByRole("radio", { name: "A-1" })).toHaveCount(0);
});

test("a zone that is not seated has no seat selection", async ({ browser, page }) => {
  const gala = await seedGala(browser, "Standing Only");
  const standing = gala.zones.find((zone) => zone.kind === "Unseated");
  const response = await page.goto(`/events/${gala.event}/zones/${standing?.id}/seats`);
  expect(response?.status()).toBe(404);
  await expect(page.locator('[data-screen="system.not-found"]')).toBeVisible();
});
