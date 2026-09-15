import type { Checkout } from "../server/checkout.ts";

/** Why a hold was refused, before any payment step (`AC-B4.4`). */
export type HoldRefusal = "sold-out" | "class-sold-out" | "seat-taken";

const REFUSALS: readonly HoldRefusal[] = ["sold-out", "class-sold-out", "seat-taken"];

/** Where a checkout stands, and so which checkout screen the page shows. */
export type CheckoutStep =
  /** No checkout in progress: none begun, or it expired before a hold. */
  | { readonly kind: "none" }
  /** Waiting for Saifu to link the buyer's account (`AD-19` A, `AC-B4.1`). */
  | { readonly kind: "handoff"; readonly handoffToken: string }
  /** Saifu linked an account: the buyer confirms the pairing code matches. */
  | { readonly kind: "pairing"; readonly pairingCode: string }
  /** Linked and confirmed, with no hold yet. */
  | { readonly kind: "hold" }
  /** The hold was refused, before any payment (`AC-B4.4`). */
  | { readonly kind: "refused"; readonly reason: HoldRefusal }
  /** Held: the buyer pays on the provider's page. `notCompleted` after a payment that did not go through. */
  | { readonly kind: "pay"; readonly notCompleted: boolean }
  /** Paid, or back from paying: waiting for the payment to be verified and the ticket issued. */
  | { readonly kind: "processing" }
  /** The ledger recorded the ticket. */
  | { readonly kind: "done"; readonly ticket: string | null; readonly cursor: string }
  /** Paid, but no ticket was issued: a refund is owed (`F-022` plan §5.5). */
  | {
      readonly kind: "refund";
      readonly amount: number;
      readonly asset: string;
    }
  /** Over with no ticket and no charge: cancelled, or the hold lapsed (`AC-B4.3`). */
  | { readonly kind: "ended" };

/** What the checkout page's URL carries: a hold's refusal, or how the buyer came back from paying. */
export interface CheckoutQuery {
  readonly refused?: string | undefined;
  readonly returned?: string | undefined;
}

/** The step a checkout is at. */
export function stepOf(checkout: Checkout | null, query: CheckoutQuery = {}): CheckoutStep {
  if (checkout === null) return { kind: "none" };
  const { account, hold, payment, sale, refund } = checkout;

  if (refund !== null) return { kind: "refund", amount: refund.amount, asset: refund.asset };
  if (sale?.status === "issued" && sale.cursor !== null) {
    return { kind: "done", ticket: sale.ticket, cursor: sale.cursor };
  }
  if (sale !== null) return { kind: "processing" };

  if (account.state === "handoff") {
    return { kind: "handoff", handoffToken: account.handoff.handoffToken };
  }
  if (account.state === "pairing") return { kind: "pairing", pairingCode: account.pairingCode };

  if (hold === null) {
    const reason = REFUSALS.find((refusal) => refusal === query.refused);
    return reason === undefined ? { kind: "hold" } : { kind: "refused", reason };
  }
  switch (hold.status) {
    case "lapsed":
    case "released":
      return { kind: "ended" };
    case "issuing":
    case "confirmed":
      return { kind: "processing" };
    case "outstanding":
      break;
  }
  if (payment?.status === "paid") return { kind: "processing" };
  if (payment?.status === "cancelled" || payment?.status === "expired") {
    return { kind: "pay", notCompleted: true };
  }
  if (query.returned === "paid" && payment?.status === "open") return { kind: "processing" };
  return { kind: "pay", notCompleted: query.returned === "cancelled" };
}
