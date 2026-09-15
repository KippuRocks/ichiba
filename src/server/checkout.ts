import { TRPCClientError } from "@trpc/client";
import { cookies } from "next/headers";
import { type ApiOutputs, kippu } from "./kippu.ts";

/** A checkout session, as `sales.checkout.get` reads it. */
export type Checkout = ApiOutputs["sales"]["checkout"]["get"];

/**
 * The cookie that carries the checkout page's token. It is set only when the buyer
 * starts a checkout — browsing sets none (`REQ-MP-7`) — and is sent only to
 * `/checkout`. The token confirms the link, holds and pays, so the browser's
 * scripts never see it, and it is never put in a URL or handed to Saifu or the
 * payment provider: Saifu gets the handoff token, which only links.
 */
export const CHECKOUT_COOKIE = "ichiba_checkout";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** How long the cookie outlives the checkout's own lifetime is not worth tuning: a day. */
const COOKIE_MAX_AGE_S = 24 * 60 * 60;

export async function checkoutToken(): Promise<string | null> {
  const value = (await cookies()).get(CHECKOUT_COOKIE)?.value;
  return value !== undefined && TOKEN.test(value) ? value : null;
}

/** Keeps a checkout's token for the checkout page. Server actions only. */
export async function keepCheckoutToken(token: string, secure: boolean): Promise<void> {
  (await cookies()).set(CHECKOUT_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/checkout",
    maxAge: COOKIE_MAX_AGE_S,
  });
}

/** The tRPC transport code of a failed call, such as `NOT_FOUND`. */
export function transportCode(error: unknown): string | null {
  return error instanceof TRPCClientError
    ? ((error.data as { code?: string } | undefined)?.code ?? null)
    : null;
}

/**
 * How long a read waits, once the sale is issued, for Kippu's copy to have the
 * ticket (`ticketVisible`, `NFR-11`). Short enough that a waiting screen still
 * re-renders often; the screen keeps asking until the copy has it.
 */
export const TICKET_VISIBLE_WAIT_MS = 4_000;

/**
 * The checkout the buyer's cookie names; `null` with none, or when it expired or
 * is unknown. Once its sale is issued, the read waits a little for the ticket to
 * be visible in Kippu's copy.
 */
export async function readCheckout(): Promise<Checkout | null> {
  const token = await checkoutToken();
  if (token === null) return null;
  try {
    return await kippu().sales.checkout.get.query({
      token,
      waitForTicketMs: TICKET_VISIBLE_WAIT_MS,
    });
  } catch (error) {
    if (transportCode(error) === "NOT_FOUND") return null;
    throw error;
  }
}
