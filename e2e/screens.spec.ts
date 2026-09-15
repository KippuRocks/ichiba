import { expect, test } from "@playwright/test";
import { byId, Walk } from "./support/walk";

test("every screen in screens.json renders its data-screen id, reached along declared transitions", async ({
  page,
}) => {
  const walk = new Walk(page);

  await walk.enter("/", "home");
  await walk.enter("/no-such-page", "system.not-found");
  await page.getByRole("link", { name: "Ichiba" }).click();
  await walk.on("home");

  expect(
    [...byId.keys()].filter((id) => !walk.visited.has(id)),
    "screens no walk reached",
  ).toEqual([]);
});
