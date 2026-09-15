import { expect, test } from "@playwright/test";
import {
  buySeat,
  buyStanding,
  holdings,
  linkInSaifu,
  providerCheckoutId,
  SAIFU_LINK_BASE,
  saifu,
  settlePayment,
  stubProviderPages,
} from "./support/checkout";
import { seedGala } from "./support/events";

const screen = (id: string) => `[data-screen="${id}"]`;

test("AC-B4.1: a buyer with no account completes checkout through Saifu, and the ticket is issued to them", async ({
  browser,
  page,
}) => {
  const gala = await seedGala(browser, "Harbour Lights");
  await stubProviderPages(page);
  const buyer = await saifu();
  expect(await holdings(buyer)).toEqual([]);

  // No account and no session in Ichiba: checkout hands off to Saifu.
  await buyStanding(page, gala.event);
  const handoff = page.locator(screen("checkout.handoff"));
  await expect(handoff).toBeVisible();
  await expect(handoff.getByRole("img", { name: /QR code/ })).toBeVisible();
  await expect(handoff.getByRole("link", { name: "Open Saifu" })).toHaveAttribute(
    "href",
    new RegExp(`^${SAIFU_LINK_BASE}/checkout#`),
  );
  await expect(page.getByTestId("checkout-price")).toHaveText("45,000.00 COPM");

  // Saifu links the buyer's account; both show the same code, which the buyer confirms.
  await linkInSaifu(page, buyer);
  await page.getByRole("button", { name: "The codes match" }).click();

  // Held; the buyer pays on the provider's page.
  const pay = page.locator(screen("checkout.pay"));
  await expect(pay).toBeVisible();
  await expect(pay.getByTestId("hold-expiry")).toContainText("more minutes");
  await pay.getByRole("button", { name: "Pay with Bloque" }).click();
  const checkoutId = await providerCheckoutId(page);

  // Back from the provider before its webhook: Ichiba waits.
  await page.goto("/checkout?returned=paid");
  await expect(page.locator(screen("checkout.processing"))).toBeVisible();
  await settlePayment(checkoutId, "paid");

  const done = page.locator(screen("checkout.done"));
  await expect(done).toBeVisible({ timeout: 20_000 });
  await expect(done.getByRole("heading", { name: "Your ticket is in Saifu" })).toBeVisible();

  // Ichiba says so only once Kippu's copy has the ticket, so Saifu already shows it.
  expect((await holdings(buyer)).map(({ ticket }) => [ticket.event, ticket.provenance])).toEqual([
    [gala.event, "Purchased"],
  ]);
});

test("AC-B4.3: when payment fails, no ticket is issued and the hold is released", async ({
  browser,
  page,
}) => {
  const gala = await seedGala(browser, "Rainy Matinee", { capacity: 1 });
  await stubProviderPages(page);
  const buyer = await saifu();

  await buyStanding(page, gala.event);
  await linkInSaifu(page, buyer);
  await page.getByRole("button", { name: "The codes match" }).click();
  await expect(page.locator(screen("checkout.pay"))).toBeVisible();

  // The only ticket is held: nothing is left to hold.
  const inventory = await page.context().request.get(`/events/${gala.event}`);
  expect(await inventory.text()).toContain("Sold out");

  // The payment attempt fails on the provider's page; the buyer comes back.
  await page.getByRole("button", { name: "Pay with Bloque" }).click();
  await settlePayment(await providerCheckoutId(page), "cancelled");
  await page.goto("/checkout?returned=cancelled");
  const pay = page.locator(screen("checkout.pay"));
  await expect(pay.getByTestId("payment-not-completed")).toContainText("nothing was charged");

  // The buyer gives up.
  await pay.getByRole("button", { name: "Cancel checkout" }).click();
  const ended = page.locator(screen("checkout.ended"));
  await expect(ended).toContainText("No ticket was issued, you have not been charged");

  // No ticket, and the hold no longer counts.
  expect(await holdings(buyer)).toEqual([]);
  await page.goto(`/events/${gala.event}`);
  await expect(page.getByTestId("class-availability")).toHaveText("1 left");
});

test("AC-B4.4: two buyers check out the last ticket; only one obtains a hold, and the other is refused before paying", async ({
  browser,
  page,
}) => {
  const gala = await seedGala(browser, "Last Call", { capacity: 1 });
  const other = await browser.newPage();
  const first = await saifu();
  const second = await saifu();

  await buyStanding(page, gala.event);
  await linkInSaifu(page, first);
  await buyStanding(other, gala.event);
  await linkInSaifu(other, second);

  await page.getByRole("button", { name: "The codes match" }).click();
  await expect(page.locator(screen("checkout.pay"))).toBeVisible();

  await other.getByRole("button", { name: "The codes match" }).click();
  const refused = other.locator(screen("checkout.refused"));
  await expect(refused.getByRole("alert")).toHaveText(
    "Sorry, the last tickets for this event have just been taken. You have not paid anything.",
  );
  await expect(other.getByRole("button", { name: "Pay with Bloque" })).toHaveCount(0);
  await other.close();
});

test("AC-B4.4: two buyers check out the same seat; the other is refused before paying and can choose another", async ({
  browser,
  page,
}) => {
  const gala = await seedGala(browser, "Front Row");
  const stalls = gala.zones.find((zone) => zone.kind === "Seated");
  if (stalls === undefined) throw new Error("zones not seeded");
  const other = await browser.newPage();
  const first = await saifu();
  const second = await saifu();

  await buySeat(page, gala.event, stalls.id, "A-1");
  await linkInSaifu(page, first);
  await buySeat(other, gala.event, stalls.id, "A-1");
  await linkInSaifu(other, second);

  await other.getByRole("button", { name: "The codes match" }).click();
  await expect(other.locator(screen("checkout.pay"))).toBeVisible();
  await expect(other.getByTestId("checkout-seat")).toHaveText("A-1");

  await page.getByRole("button", { name: "The codes match" }).click();
  const refused = page.locator(screen("checkout.refused"));
  await expect(refused.getByRole("alert")).toContainText("this seat has just been taken");
  await expect(page.getByRole("button", { name: "Pay with Bloque" })).toHaveCount(0);
  await refused.getByRole("link", { name: "Choose another seat" }).click();
  await expect(page.locator(screen("event.seats"))).toBeVisible();
  await expect(page.getByRole("radio", { name: "A-1" })).toHaveCount(0);
  await other.close();
});

test("the codes don't match: the link is discarded and Saifu is handed a new token", async ({
  browser,
  page,
}) => {
  const gala = await seedGala(browser, "Mismatch Night");
  const intruder = await saifu();
  const buyer = await saifu();

  await buyStanding(page, gala.event);
  const seen = await page.getByRole("link", { name: "Open Saifu" }).getAttribute("href");
  await linkInSaifu(page, intruder);
  await page.getByRole("button", { name: "The codes don't match" }).click();

  await expect(page.locator(screen("checkout.handoff"))).toBeVisible();
  const fresh = await page.getByRole("link", { name: "Open Saifu" }).getAttribute("href");
  expect(fresh).not.toBe(seen);
  // The token that was seen links nothing any more.
  await expect(intruder.link((seen as string).split("#")[1] as string)).rejects.toThrow();
  await linkInSaifu(page, buyer);
  await expect(page.locator(screen("checkout.pairing"))).toBeVisible();
});

test("paid but not issued: the buyer is told a refund will be claimable", async ({
  browser,
  page,
}) => {
  const gala = await seedGala(browser, "Short Change");
  await stubProviderPages(page);
  const buyer = await saifu();

  await buyStanding(page, gala.event);
  await linkInSaifu(page, buyer);
  await page.getByRole("button", { name: "The codes match" }).click();
  await page.getByRole("button", { name: "Pay with Bloque" }).click();
  // The provider takes another amount than the price: Kippu issues nothing, and owes a refund.
  await settlePayment(await providerCheckoutId(page), "paid", { amount: 100 });
  await page.goto("/checkout?returned=paid");

  const refund = page.locator(screen("checkout.refund"));
  await expect(refund).toBeVisible({ timeout: 20_000 });
  await expect(refund.getByRole("alert")).toContainText(
    "A refund of 1.00 COPM is owed to you, and you will be able to claim it.",
  );
  expect(await holdings(buyer)).toEqual([]);
});

test("REQ-MP-7: browsing sets no cookie; only starting a checkout does, for the checkout page alone", async ({
  browser,
  page,
  context,
}) => {
  const gala = await seedGala(browser, "Cookie Check");
  await page.goto(`/events/${gala.event}`);
  expect(await context.cookies()).toEqual([]);
  await buyStanding(page, gala.event);
  const cookies = await context.cookies();
  expect(
    cookies.map(({ name, path, httpOnly, sameSite }) => ({ name, path, httpOnly, sameSite })),
  ).toEqual([{ name: "ichiba_checkout", path: "/checkout", httpOnly: true, sameSite: "Lax" }]);
  // The checkout page's token appears in no link and no URL.
  const token = cookies[0]?.value as string;
  expect(await page.content()).not.toContain(token);
});
