import { expect, test } from "@playwright/test";
import {
  buySeat,
  handoffToken,
  linkInSaifu,
  providerCheckoutId,
  saifu,
  settlePayment,
  stubProviderPages,
} from "./support/checkout";
import { seedGala } from "./support/events";
import { placeHold } from "./support/kippu";
import { byId, Walk } from "./support/walk";

test("every screen in screens.json renders its data-screen id, reached along declared transitions", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const gala = await seedGala(browser, "Screen Walk");
  const { event } = gala;
  const stalls = gala.zones.find((zone) => zone.kind === "Seated");
  if (stalls === undefined) throw new Error("zones not seeded");
  await stubProviderPages(page);
  const walk = new Walk(page);

  // Browsing.
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

  // A checkout with no session yet.
  await walk.enter("/checkout", "checkout.none");
  await page.getByRole("link", { name: "Find events" }).click();
  await walk.on("home");

  // Checkout from the event page: handoff, a mismatched code, pairing, hold, payment, ticket.
  const buyer = await saifu();
  await walk.enter(`/events/${event}`, "event.detail");
  await page
    .getByRole("list", { name: "General admission" })
    .getByRole("button", { name: "Buy a ticket" })
    .click();
  await walk.on("checkout.handoff");
  await page.getByRole("link", { name: "Back to the event" }).click();
  await walk.on("event.detail");
  await walk.enter("/checkout", "checkout.handoff");
  await linkInSaifu(page, await saifu());
  await walk.on("checkout.pairing");
  await page.getByRole("button", { name: "The codes don't match" }).click();
  await walk.on("checkout.handoff");
  await linkInSaifu(page, buyer);
  await walk.on("checkout.pairing");
  await page.getByRole("button", { name: "The codes match" }).click();
  await walk.on("checkout.pay");
  await page.getByRole("button", { name: "Pay with Bloque" }).click();
  const paid = await providerCheckoutId(page);
  await walk.arrive("/checkout?returned=paid", "checkout.processing");
  await settlePayment(paid, "paid");
  await walk.on("checkout.done", { timeout: 20_000 });
  await page.getByRole("link", { name: "Find more events" }).click();
  await walk.on("home");

  // A payment that does not go through, then cancelled.
  await walk.enter(`/events/${event}`, "event.detail");
  await page
    .getByRole("list", { name: "General admission" })
    .getByRole("button", { name: "Buy a ticket" })
    .click();
  await walk.on("checkout.handoff");
  await linkInSaifu(page, buyer);
  await walk.on("checkout.pairing");
  await page.getByRole("button", { name: "The codes match" }).click();
  await walk.on("checkout.pay");
  await page.getByRole("button", { name: "Pay with Bloque" }).click();
  await settlePayment(await providerCheckoutId(page), "cancelled");
  await walk.arrive("/checkout?returned=cancelled", "checkout.pay");
  await page.getByRole("button", { name: "Cancel checkout" }).click();
  await walk.on("checkout.ended");
  await page.getByRole("link", { name: "Back to the event" }).click();
  await walk.on("event.detail");

  // Paid for another amount: a refund is owed.
  await page
    .getByRole("list", { name: "General admission" })
    .getByRole("button", { name: "Buy a ticket" })
    .click();
  await walk.on("checkout.handoff");
  await linkInSaifu(page, buyer);
  await walk.on("checkout.pairing");
  await page.getByRole("button", { name: "The codes match" }).click();
  await walk.on("checkout.pay");
  await page.getByRole("button", { name: "Pay with Bloque" }).click();
  await settlePayment(await providerCheckoutId(page), "paid", { amount: 1 });
  await walk.arrive("/checkout?returned=paid", "checkout.refund");
  await page.getByRole("link", { name: "Find events" }).click();
  await walk.on("home");

  // A seat taken while the buyer pairs: refused, then asked again, then another seat.
  await walk.enter(`/events/${event}/zones/${stalls.id}/seats?seat=A-4`, "event.seats");
  await page.getByRole("button", { name: "Buy this seat" }).click();
  await walk.on("checkout.handoff");
  const token = await handoffToken(page);
  const code = await buyer.link(token);
  await walk.on("checkout.pairing");
  expect(code).toMatch(/^[0-9]{6}$/);
  const rival = await saifu();
  const taken = await placeHold(rival.token, {
    event,
    zone: stalls.id,
    class: gala.purchasedClass as string,
    seat: "A-4",
  });
  expect(taken.outcome).toBe("held");
  await page.getByRole("button", { name: "The codes match" }).click();
  await walk.on("checkout.refused");
  await walk.arrive("/checkout", "checkout.hold");
  await page.getByRole("button", { name: "Hold this ticket" }).click();
  await walk.on("checkout.refused");
  await page.getByRole("link", { name: "Choose another seat" }).click();
  await walk.on("event.seats");
  await buySeat(page, event, stalls.id, "A-3");
  await walk.on("checkout.handoff");
  await page.getByRole("link", { name: "Back to the event" }).click();
  await walk.on("event.detail");
  await walk.enter("/checkout", "checkout.handoff");
  await buyer.link(await handoffToken(page));
  await walk.on("checkout.pairing");
  await page.getByRole("button", { name: "The codes match" }).click();
  await walk.on("checkout.pay");
  await page.getByRole("button", { name: "Cancel checkout" }).click();
  await walk.on("checkout.ended");
  await page.getByRole("link", { name: "Back to the event" }).click();
  await walk.on("event.detail");
  await walk.enter(`/events/${event}/zones/${stalls.id}/seats?seat=A-2`, "event.seats");
  await page.getByRole("button", { name: "Buy this seat" }).click();
  await walk.on("checkout.handoff");
  await page.getByRole("link", { name: "Ichiba" }).click();
  await walk.on("home");
  await walk.enter("/checkout", "checkout.handoff");
  await linkInSaifu(page, buyer);
  await walk.on("checkout.pairing");
  await page.getByRole("link", { name: "Ichiba" }).click();
  await walk.on("home");

  // The refused screen's way back to the event, when the event itself is sold out.
  const small = await seedGala(browser, "Screen Walk Small", { capacity: 1 });
  await walk.enter(`/events/${small.event}`, "event.detail");
  await page
    .getByRole("list", { name: "General admission" })
    .getByRole("button", { name: "Buy a ticket" })
    .click();
  await walk.on("checkout.handoff");
  await linkInSaifu(page, buyer);
  await walk.on("checkout.pairing");
  const smallStanding = small.zones.find((zone) => zone.kind === "Unseated");
  const rivalHold = await placeHold(rival.token, {
    event: small.event,
    zone: smallStanding?.id as string,
    class: small.purchasedClass as string,
  });
  expect(rivalHold.outcome).toBe("held");
  await page.getByRole("button", { name: "The codes match" }).click();
  await walk.on("checkout.refused");
  await page.getByRole("link", { name: "Back to the event" }).click();
  await walk.on("event.detail");

  expect(
    [...byId.keys()].filter((id) => !walk.visited.has(id)),
    "screens no walk reached",
  ).toEqual([]);
});
