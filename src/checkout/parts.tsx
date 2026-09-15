import type { ReactNode } from "react";
import type { HoldRefusal } from "./steps.ts";
import type { CheckoutSummary } from "./summary.ts";

/** What is being bought. */
export function Summary({ summary }: { summary: CheckoutSummary }) {
  return (
    <dl className="checkout-summary" aria-label="Your ticket">
      <dt>Event</dt>
      <dd>{summary.eventName}</dd>
      <dt>Ticket</dt>
      <dd>{summary.className}</dd>
      <dt>Zone</dt>
      <dd>{summary.zoneName}</dd>
      {summary.seat !== null && (
        <>
          <dt>Seat</dt>
          <dd data-testid="checkout-seat">{summary.seat}</dd>
        </>
      )}
      {summary.price !== null && (
        <>
          <dt>Price</dt>
          <dd data-testid="checkout-price">{summary.price}</dd>
        </>
      )}
    </dl>
  );
}

/** The handoff to Saifu: a QR code for a desktop, and the same link for the phone Saifu is on. */
export function Handoff({ qrCode, link }: { qrCode: string; link: ReactNode }) {
  return (
    <div className="handoff">
      <p>
        Your ticket goes to Saifu, the app that keeps your tickets. Saifu sets up your account if
        you don't have one yet.
      </p>
      <figure className="handoff-qr">
        {/* biome-ignore lint/performance/noImgElement: an inline SVG data URL, generated on the server. */}
        <img
          src={qrCode}
          alt="QR code that opens this checkout in Saifu"
          width={220}
          height={220}
        />
        <figcaption>On a computer: scan this code with the phone Saifu is on.</figcaption>
      </figure>
      <p className="handoff-link">On your phone: {link}</p>
      <p role="status">Waiting for Saifu…</p>
    </div>
  );
}

/** The pairing code, grouped in threes for reading aloud. */
export function PairingCode({ code }: { code: string }) {
  return (
    <p className="pairing-code" data-testid="pairing-code">
      {code.slice(0, 3)} {code.slice(3)}
    </p>
  );
}

const REFUSAL_COPY: Readonly<Record<HoldRefusal, string>> = {
  "sold-out": "Sorry, the last tickets for this event have just been taken.",
  "class-sold-out": "Sorry, tickets of this kind have just sold out.",
  "seat-taken": "Sorry, this seat has just been taken by someone else.",
};

/** Why the ticket could not be held — before any payment step (`AC-B4.4`). */
export function Refusal({ reason }: { reason: HoldRefusal }) {
  return (
    <p className="checkout-refused" role="alert" data-refusal={reason}>
      {REFUSAL_COPY[reason]} You have not paid anything.
    </p>
  );
}
