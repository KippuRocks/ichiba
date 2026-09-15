import { expect, test } from "@playwright/test";
import { seedGala } from "./support/events";

test("REQ-MP-7: the home page lists events on sale with no session or cookies", async ({
  browser,
  page,
  context,
  request,
}) => {
  const notOnSale = await seedGala(browser, "Rehearsal Without Sales", { onSale: false });
  const onSale = await seedGala(browser, "Winter Recital");

  // Rendered on the server: the listing is in the HTML itself, fetched with no cookies.
  const html = await request.get("/", { headers: { cookie: "" } });
  expect(html.status()).toBe(200);
  expect(html.headers()["set-cookie"]).toBeUndefined();
  expect(await html.text()).toContain("Winter Recital");

  await page.goto("/");
  const index = page.locator('[data-screen="home"]').getByRole("list", { name: "Events on sale" });
  const entry = index.getByRole("link", { name: /Winter Recital/ });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText("Teatro Real");
  await expect(entry).toContainText("Thursday, 1 October 2026 at 20:00");
  // An event with no Purchased class sells nothing, so it is not on sale.
  await expect(index.getByRole("link", { name: /Rehearsal Without Sales/ })).toHaveCount(0);
  await expect(page.locator(`a[href="/events/${notOnSale.event}"]`)).toHaveCount(0);

  await entry.click();
  await expect(page).toHaveURL(`/events/${onSale.event}`);
  await expect(page.getByRole("heading", { level: 1, name: "Winter Recital" })).toBeVisible();

  expect(await context.cookies()).toEqual([]);
  expect(
    await page.evaluate(() => [document.cookie, sessionStorage.length, localStorage.length]),
  ).toEqual(["", 0, 0]);
});

test("a page token the index refuses shows the page-not-found screen", async ({ page }) => {
  const response = await page.goto("/?page=not-a-page-token");
  expect(response?.status()).toBe(404);
  await expect(page.locator('[data-screen="system.not-found"]')).toBeVisible();
});
