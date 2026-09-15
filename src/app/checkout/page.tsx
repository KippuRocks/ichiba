import type { Metadata } from "next";
import { connection } from "next/server";
import QRCode from "qrcode";
import { Handoff, PairingCode, Refusal, Summary } from "../../checkout/parts.tsx";
import { type CheckoutStep, stepOf } from "../../checkout/steps.ts";
import { minutesLeft, priceOf, summaryOf } from "../../checkout/summary.ts";
import { present } from "../../events/view.ts";
import { AppLink } from "../../screens/AppLink.tsx";
import { transition } from "../../screens/navigation.ts";
import { Refresh } from "../../screens/Refresh.tsx";
import { Screen } from "../../screens/Screen.tsx";
import { ScreenLink } from "../../screens/ScreenLink.tsx";
import { type Checkout, readCheckout } from "../../server/checkout.ts";
import { saifuCheckoutLink } from "../../server/config.ts";
import { readEvent, readInventory } from "../../server/events.ts";
import { cancelCheckout, confirmPairing, holdTicket, pay, rejectPairing } from "./actions.ts";

export const metadata: Metadata = { title: "Checkout" };

/** How often a waiting screen asks the server again. */
const POLL_MS = 1500;

/**
 * The transitions the checkout page makes by rendering another step at the same
 * URL — after a refresh, or on coming back from the payment page — rather than
 * by a link or an action.
 */
export const STEP_TRANSITIONS = [
  transition("checkout.handoff", "checkout.pairing"),
  transition("checkout.handoff", "checkout.none"),
  transition("checkout.pairing", "checkout.handoff"),
  transition("checkout.pay", "checkout.processing"),
  transition("checkout.pay", "checkout.ended"),
  transition("checkout.pay", "checkout.refund"),
  transition("checkout.processing", "checkout.done"),
  transition("checkout.processing", "checkout.refund"),
  transition("checkout.processing", "checkout.pay"),
  transition("checkout.processing", "checkout.ended"),
  transition("checkout.refused", "checkout.hold"),
] as const;

interface Props {
  readonly searchParams: Promise<{ readonly refused?: string; readonly returned?: string }>;
}

/**
 * Checkout (`F-060` plan §5, as ruled in `M2`): the account from Saifu, confirmed
 * by the pairing code; the hold; payment on the provider's page; and the ticket.
 * One URL, whose screen follows the checkout's state in kippu-api. Rendered on the
 * server for every request; Ichiba holds no keys and signs nothing (`REQ-CL-4`).
 */
export default async function CheckoutPage({ searchParams }: Props) {
  await connection();
  const query = await searchParams;
  const checkout = await readCheckout();
  const step = stepOf(checkout, {
    refused: typeof query.refused === "string" ? query.refused : undefined,
    returned: typeof query.returned === "string" ? query.returned : undefined,
  });
  if (checkout === null || step.kind === "none") {
    return (
      <Screen id="checkout.none">
        <h1>No checkout in progress</h1>
        <p>This checkout has expired, or none was started in this browser.</p>
        <ScreenLink from="checkout.none" to="home" params={{}}>
          Find events
        </ScreenLink>
      </Screen>
    );
  }
  return <Step checkout={checkout} step={step} />;
}

async function Step({ checkout, step }: { checkout: Checkout; step: CheckoutStep }) {
  const view = await readEvent(checkout.event);
  const event = view === null ? null : present(view);
  const inventory =
    event === null || event.closed !== null ? null : await readInventory(checkout.event);
  const summary = summaryOf(checkout, event, inventory);

  switch (step.kind) {
    case "none":
      return null;

    case "handoff": {
      const link = saifuCheckoutLink(step.handoffToken);
      const qrCode = await QRCode.toDataURL(link, { type: "image/png", margin: 1, width: 220 });
      return (
        <Screen id="checkout.handoff">
          <Refresh every={POLL_MS} />
          <h1>Continue in Saifu</h1>
          <Summary summary={summary} />
          <Handoff
            qrCode={qrCode}
            link={
              <AppLink
                from="checkout.handoff"
                to="saifu:checkout.link"
                href={link}
                className="button"
              >
                Open Saifu
              </AppLink>
            }
          />
          <p>
            {
              <ScreenLink
                from="checkout.handoff"
                to="event.detail"
                params={{ event: checkout.event }}
              >
                Back to the event
              </ScreenLink>
            }
          </p>
        </Screen>
      );
    }

    case "pairing":
      return (
        <Screen id="checkout.pairing">
          <h1>Check the code</h1>
          <p>Saifu shows a 6-digit code. Check that it is the same as this one:</p>
          <PairingCode code={step.pairingCode} />
          <p>
            If it matches, your ticket is held for you and goes to the Saifu account that shows it.
          </p>
          <div className="checkout-actions">
            <form action={confirmPairing}>
              <input type="hidden" name="pairingCode" value={step.pairingCode} />
              <button type="submit">The codes match</button>
            </form>
            <form action={rejectPairing}>
              <button type="submit" className="secondary">
                The codes don't match
              </button>
            </form>
          </div>
          <Summary summary={summary} />
        </Screen>
      );

    case "hold":
      return (
        <Screen id="checkout.hold">
          <h1>Hold your ticket</h1>
          <Summary summary={summary} />
          <form action={holdTicket}>
            <button type="submit">Hold this ticket</button>
          </form>
        </Screen>
      );

    case "refused":
      return (
        <Screen id="checkout.refused">
          <h1>This ticket is not available</h1>
          <Refusal reason={step.reason} />
          <Summary summary={summary} />
          <p>
            {step.reason === "seat-taken" ? (
              <ScreenLink
                from="checkout.refused"
                to="event.seats"
                params={{ event: checkout.event, zone: checkout.zone }}
              >
                Choose another seat
              </ScreenLink>
            ) : (
              <ScreenLink
                from="checkout.refused"
                to="event.detail"
                params={{ event: checkout.event }}
              >
                Back to the event
              </ScreenLink>
            )}
          </p>
        </Screen>
      );

    case "pay": {
      const hold = checkout.hold;
      return (
        <Screen id="checkout.pay">
          <h1>Pay for your ticket</h1>
          {step.notCompleted && (
            <p role="status" className="checkout-notice" data-testid="payment-not-completed">
              Your payment was not completed, and nothing was charged. You can try again while the
              ticket is held for you.
            </p>
          )}
          <Summary summary={summary} />
          {hold !== null && (
            <p data-testid="hold-expiry">
              Held for you for {minutesLeft(hold.expiresAt, new Date())} more minutes.
            </p>
          )}
          <p>You pay on Bloque's secure page, by card or PSE. Ichiba never sees your card.</p>
          <div className="checkout-actions">
            <form action={pay}>
              <button type="submit">Pay with Bloque</button>
            </form>
            <form action={cancelCheckout}>
              <button type="submit" className="secondary">
                Cancel checkout
              </button>
            </form>
          </div>
        </Screen>
      );
    }

    case "processing":
      return (
        <Screen id="checkout.processing">
          <Refresh every={POLL_MS} />
          <h1>Issuing your ticket</h1>
          <p role="status">
            We are confirming your payment and issuing your ticket. This page updates by itself.
          </p>
          <Summary summary={summary} />
        </Screen>
      );

    case "done":
      return (
        <Screen id="checkout.done">
          <h1>Your ticket is in Saifu</h1>
          <p role="status">
            Your ticket for {summary.eventName} has been issued to your Saifu account. Open Saifu to
            see it.
          </p>
          <Summary summary={summary} />
          <ScreenLink from="checkout.done" to="home" params={{}}>
            Find more events
          </ScreenLink>
        </Screen>
      );

    case "refund": {
      const amount = priceOf(step.amount, step.asset);
      return (
        <Screen id="checkout.refund">
          <h1>No ticket was issued</h1>
          <p role="alert">
            Your payment went through, but your ticket could not be issued. A refund of{" "}
            {amount ?? "the amount you paid"} is owed to you, and you will be able to claim it. We
            will ask where to send it only when you claim it.
          </p>
          <Summary summary={summary} />
          <ScreenLink from="checkout.refund" to="home" params={{}}>
            Find events
          </ScreenLink>
        </Screen>
      );
    }

    case "ended":
      return (
        <Screen id="checkout.ended">
          <h1>Checkout ended</h1>
          <p role="status">
            No ticket was issued, you have not been charged, and the ticket is no longer held for
            you.
          </p>
          <Summary summary={summary} />
          <p>
            {
              <ScreenLink
                from="checkout.ended"
                to="event.detail"
                params={{ event: checkout.event }}
              >
                Back to the event
              </ScreenLink>
            }
          </p>
        </Screen>
      );
  }
}
