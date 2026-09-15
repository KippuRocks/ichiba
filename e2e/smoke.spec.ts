import { expect, test } from "@playwright/test";

test("the production build serves its home page to a visitor with no session or cookies (REQ-MP-7)", async ({
  page,
  context,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Ichiba" })).toBeVisible();
  expect(response?.headers()["set-cookie"]).toBeUndefined();
  expect(await context.cookies()).toEqual([]);
});

test("the server reaches the Kippu API through its @kippu/api client", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", api: "ok" });
});
