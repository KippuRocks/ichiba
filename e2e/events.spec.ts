import { expect, test } from "@playwright/test";
import { seedGala } from "./support/events";

test("REQ-MP-7 AC-A3.2: an event page renders its ledger facts and document as one, with no session or cookies", async ({
  browser,
  page,
  context,
  request,
}) => {
  const { event } = await seedGala(browser);

  // Rendered on the server: the HTML itself carries the event, fetched with no cookies.
  const html = await request.get(`/events/${event}`, { headers: { cookie: "" } });
  expect(html.status()).toBe(200);
  expect(html.headers()["set-cookie"]).toBeUndefined();
  expect(await html.text()).toContain("Autumn Gala");

  const response = await page.goto(`/events/${event}`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()["set-cookie"]).toBeUndefined();
  const screen = page.locator('[data-screen="event.detail"]');
  await expect(screen.getByRole("heading", { level: 1, name: "Autumn Gala" })).toBeVisible();
  await expect(page).toHaveTitle("Autumn Gala · Ichiba");
  await expect(screen).toContainText("By Gala Productions");
  await expect(screen).toContainText("Teatro Real");
  await expect(screen).toContainText("Madrid, ES");
  await expect(screen).toContainText("Thursday, 1 October 2026 at 20:00");
  // Zone kinds are ledger facts; their names come from the document.
  const zones = screen.getByRole("region", { name: "Zones" }).getByRole("listitem");
  await expect(zones).toHaveText(["Stalls Seated", "Standing General admission"]);
  await expect(screen.getByTestId("event-closed")).toHaveCount(0);

  expect(await context.cookies()).toEqual([]);
  expect(
    await page.evaluate(() => [document.cookie, sessionStorage.length, localStorage.length]),
  ).toEqual(["", 0, 0]);
});

test("an address that names no event shows the page-not-found screen", async ({ page }) => {
  for (const path of [`/events/${"0".repeat(64)}`, "/events/not-an-event-id"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.locator('[data-screen="system.not-found"]')).toBeVisible();
  }
});
