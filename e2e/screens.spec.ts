import { expect, test } from "@playwright/test";
import { seedGala } from "./support/events";
import { byId, Walk } from "./support/walk";

test("every screen in screens.json renders its data-screen id, reached along declared transitions", async ({
  page,
  browser,
}) => {
  const { event } = await seedGala(browser, "Screen Walk");
  const walk = new Walk(page);

  await walk.enter("/", "home");
  await page
    .getByRole("link", { name: /Screen Walk/ })
    .first()
    .click();
  await walk.on("event.detail");
  await page.getByRole("link", { name: "Ichiba" }).click();
  await walk.on("home");
  await walk.enter("/no-such-page", "system.not-found");
  await page.getByRole("link", { name: "Ichiba" }).click();
  await walk.on("home");
  await walk.enter(`/events/${event}`, "event.detail");
  await page.getByRole("link", { name: "Choose a seat" }).click();
  await walk.on("event.seats");
  await page.getByRole("link", { name: /^Back to / }).click();
  await walk.on("event.detail");
  await page.getByRole("link", { name: "Choose a seat" }).click();
  await walk.on("event.seats");
  await page.getByRole("link", { name: "Ichiba" }).click();
  await walk.on("home");
  await walk.enter(`/events/${event}`, "event.detail");
  await page.getByRole("link", { name: "Ichiba" }).click();
  await walk.on("home");

  expect(
    [...byId.keys()].filter((id) => !walk.visited.has(id)),
    "screens no walk reached",
  ).toEqual([]);
});
