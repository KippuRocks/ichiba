import { expect, type Page } from "@playwright/test";
import { API_URL, api } from "./kippu";
import { holderSession } from "./saifu";

/** Where the test payment provider says its hosted checkouts are; no such host exists. */
const PROVIDER_PAGES = "https://payments.test.invalid/**";

/** The placeholder origin Saifu's links live under, as Ichiba is configured by default. */
export const SAIFU_LINK_BASE = "https://saifu.kippu.example";

/**
 * Stands in for the payment provider's hosted page in `page`: a page with
 * nothing to fill in. The test decides the outcome through the test API.
 */
export async function stubProviderPages(page: Page): Promise<void> {
  await page.route(PROVIDER_PAGES, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Payment</title><h1>Test payment page</h1>",
    }),
  );
}

/** The handoff token Ichiba's "Open Saifu" link carries in its fragment. */
export async function handoffToken(page: Page): Promise<string> {
  const href = await page.getByRole("link", { name: "Open Saifu" }).getAttribute("href");
  expect(href).toMatch(new RegExp(`^${SAIFU_LINK_BASE}/checkout#[A-Za-z0-9_-]{43}$`));
  return (href as string).split("#")[1] as string;
}

/** A buyer's Saifu, standing in for the app: a holder account and its session. */
export interface Saifu {
  readonly token: string;
  readonly account: string;
  /** Links the checkout the handoff token names, as Saifu's `checkout.link` screen does; answers the pairing code Saifu shows. */
  link(handoffToken: string): Promise<string>;
}

export async function saifu(): Promise<Saifu> {
  const holder = await holderSession();
  return {
    ...holder,
    async link(handoff) {
      const linked = await api(holder.token).sales.checkout.link.mutate({ handoffToken: handoff });
      return linked.pairingCode;
    },
  };
}

/** Saifu links the page's checkout; the page shows the same pairing code. Answers the code. */
export async function linkInSaifu(page: Page, buyer: Saifu): Promise<string> {
  const code = await buyer.link(await handoffToken(page));
  await expect(page.getByTestId("pairing-code")).toHaveText(
    `${code.slice(0, 3)} ${code.slice(3)}`,
    {
      timeout: 10_000,
    },
  );
  return code;
}

/** The provider's checkout id on its hosted page, where Ichiba sent the buyer. */
export async function providerCheckoutId(page: Page): Promise<string> {
  await page.waitForURL(PROVIDER_PAGES);
  const id = new URL(page.url()).pathname.split("/").pop();
  expect(id).toBeTruthy();
  return id as string;
}

/** The buyer's outcome on the provider's page, delivered to kippu-api as the provider's webhook. */
export async function settlePayment(
  checkoutId: string,
  outcome: "paid" | "cancelled" | "expired",
  options: { readonly amount?: number } = {},
): Promise<void> {
  const response = await fetch(`${API_URL}/v0/testing/payments/${encodeURIComponent(checkoutId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outcome, ...options }),
  });
  expect(response.status, await response.clone().text()).toBe(200);
}

/** The tickets the buyer's Saifu account holds, as Kippu's derived copy reads them. */
export async function holdings(buyer: Saifu) {
  const read = await api(buyer.token).derived.holdings.mine.query();
  return read.holdings;
}

/** Starts a checkout for a standing ticket from the event page. */
export async function buyStanding(page: Page, event: string): Promise<void> {
  await page.goto(`/events/${event}`);
  await page
    .getByRole("list", { name: "General admission" })
    .getByRole("button", { name: "Buy a ticket" })
    .click();
  await expect(page).toHaveURL("/checkout");
}

/** Starts a checkout for a seat from the seat page. */
export async function buySeat(
  page: Page,
  event: string,
  zone: string,
  seat: string,
): Promise<void> {
  await page.goto(`/events/${event}/zones/${zone}/seats?seat=${encodeURIComponent(seat)}`);
  await page.getByRole("button", { name: "Buy this seat" }).click();
  await expect(page).toHaveURL("/checkout");
}
