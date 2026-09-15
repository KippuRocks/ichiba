"use server";

import { leave, navigate } from "../../screens/navigation.ts";
import { checkoutToken, keepCheckoutToken, transportCode } from "../../server/checkout.ts";
import { publicUrl } from "../../server/config.ts";
import { kippu } from "../../server/kippu.ts";

/**
 * Checkout's server actions (`F-060` plan §5, `F-022` plan §5.1). Each acts
 * with the checkout page's token from its cookie, through kippu-api, and
 * Ichiba signs nothing (`REQ-CL-4`): the buyer's account comes from Saifu, and
 * payment happens on the provider's page.
 */

const ID = /^[0-9a-f]{64}$/;

function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Begins a checkout for what the buyer picked, and keeps its token for the checkout page. */
async function begin(form: FormData): Promise<void> {
  const event = field(form, "event");
  const zone = field(form, "zone");
  const ticketClass = field(form, "class");
  const seat = field(form, "seat");
  if (!ID.test(event) || !ID.test(zone) || !ID.test(ticketClass)) {
    throw new Error("a checkout names an event, a zone and a class");
  }
  const { token } = await kippu().sales.checkout.begin.mutate({
    event,
    zone,
    class: ticketClass,
    placement: seat === "" ? { kind: "Unseated" } : { kind: "Seated", position: seat },
  });
  await keepCheckoutToken(token, publicUrl().startsWith("https:"));
}

/** Buys a ticket in an unseated zone, from the event page. */
export async function buyTicket(form: FormData): Promise<void> {
  await begin(form);
  navigate("event.detail", "checkout.handoff", {});
}

/** Buys the selected seat, from the seat page. */
export async function buySeat(form: FormData): Promise<void> {
  await begin(form);
  navigate("event.seats", "checkout.handoff", {});
}

async function requireToken(): Promise<string> {
  const token = await checkoutToken();
  if (token === null) navigate("checkout.none", "checkout.none", {});
  return token;
}

/** Places the hold; a refusal is shown before any payment step (`AC-B4.4`). */
async function placeHold(
  token: string,
): Promise<"held" | "sold-out" | "class-sold-out" | "seat-taken"> {
  const outcome = await kippu().sales.checkout.hold.mutate({ token });
  return outcome.outcome === "held" ? "held" : outcome.reason;
}

/**
 * The buyer confirms that Saifu shows the same pairing code; the hold follows at
 * once. A code that no longer matches — Saifu linked again — shows the page again.
 */
export async function confirmPairing(form: FormData): Promise<void> {
  const token = await requireToken();
  try {
    await kippu().sales.checkout.confirmLink.mutate({
      token,
      pairingCode: field(form, "pairingCode"),
    });
  } catch (error) {
    const code = transportCode(error);
    if (code === "CONFLICT" || code === "PRECONDITION_FAILED" || code === "BAD_REQUEST") {
      navigate("checkout.pairing", "checkout.pairing", {});
    }
    throw error;
  }
  const held = await placeHold(token);
  if (held !== "held") navigate("checkout.pairing", "checkout.refused", {}, { refused: held });
  navigate("checkout.pairing", "checkout.pay", {});
}

/** The codes do not match: the link is discarded, and Saifu is handed a new token. */
export async function rejectPairing(): Promise<void> {
  const token = await requireToken();
  try {
    await kippu().sales.checkout.discardLink.mutate({ token });
  } catch (error) {
    if (transportCode(error) !== "PRECONDITION_FAILED") throw error;
  }
  navigate("checkout.pairing", "checkout.handoff", {});
}

/** Places the hold for a linked checkout that has none. */
export async function holdTicket(): Promise<void> {
  const token = await requireToken();
  const held = await placeHold(token);
  if (held !== "held") navigate("checkout.hold", "checkout.refused", {}, { refused: held });
  navigate("checkout.hold", "checkout.pay", {});
}

/**
 * Sends the buyer to the provider's hosted checkout, created for the hold
 * (`F-022` plan §5.4): Ichiba never sees payment details. The provider sends the
 * buyer back to the checkout page either way.
 */
export async function pay(): Promise<void> {
  const token = await requireToken();
  const base = publicUrl();
  let url: string;
  try {
    const payment = await kippu().sales.checkout.pay.mutate({
      token,
      successUrl: `${base}/checkout?returned=paid`,
      cancelUrl: `${base}/checkout?returned=cancelled`,
    });
    url = payment.url;
  } catch (error) {
    const code = transportCode(error);
    // The hold ended, or is already paid: the checkout page says which.
    if (code === "CONFLICT" || code === "PRECONDITION_FAILED") {
      navigate("checkout.pay", "checkout.processing", {});
    }
    throw error;
  }
  leave("checkout.pay", url);
}

/** The buyer gives up: the hold is released, with no ticket and no charge (`AC-B4.3`). */
export async function cancelCheckout(): Promise<void> {
  const token = await requireToken();
  try {
    await kippu().sales.checkout.cancel.mutate({ token });
  } catch (error) {
    if (transportCode(error) !== "CONFLICT") throw error;
  }
  navigate("checkout.pay", "checkout.ended", {});
}
