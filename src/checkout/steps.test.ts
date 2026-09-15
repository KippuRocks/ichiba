import { describe, expect, it } from "vitest";
import type { Checkout } from "../server/checkout.ts";
import { stepOf } from "./steps.ts";
import { minutesLeft, priceOf, summaryOf } from "./summary.ts";

const TOKEN = "t".repeat(43);

function checkout(overrides: Partial<Checkout> = {}): Checkout {
  return {
    event: "ab".repeat(32),
    zone: "01".repeat(32),
    class: "c1".repeat(32),
    placement: { kind: "Unseated" },
    account: { state: "linked", holder: "cd".repeat(32) },
    hold: null,
    payment: null,
    sale: null,
    refund: null,
    createdAt: "2026-09-14T20:00:00.000Z",
    expiresAt: "2026-09-14T21:00:00.000Z",
    ...overrides,
  };
}

const hold = (status: NonNullable<Checkout["hold"]>["status"]): Checkout["hold"] => ({
  status,
  expiresAt: "2026-09-14T20:15:00.000Z",
  extended: false,
  asset: "COPM/2",
  price: 4_500_000,
});

const payment = (status: NonNullable<Checkout["payment"]>["status"]): Checkout["payment"] => ({
  status,
  url: "https://payments.test.invalid/checkout/test-checkout-1",
  amount: 4_500_000,
  asset: "COPM/2",
  expiresAt: "2026-09-14T20:15:00.000Z",
});

describe("the checkout step", () => {
  it("shows none without a checkout", () => {
    expect(stepOf(null)).toEqual({ kind: "none" });
  });

  it("AC-B4.1: hands off to Saifu, then asks the buyer to confirm the pairing code", () => {
    expect(
      stepOf(checkout({ account: { state: "handoff", handoff: { handoffToken: TOKEN } } })),
    ).toEqual({ kind: "handoff", handoffToken: TOKEN });
    expect(stepOf(checkout({ account: { state: "pairing", pairingCode: "123456" } }))).toEqual({
      kind: "pairing",
      pairingCode: "123456",
    });
  });

  it("AC-B4.4: shows a refused hold before any payment step", () => {
    expect(stepOf(checkout(), { refused: "seat-taken" })).toEqual({
      kind: "refused",
      reason: "seat-taken",
    });
    expect(stepOf(checkout(), { refused: "made-up" })).toEqual({ kind: "hold" });
    expect(stepOf(checkout())).toEqual({ kind: "hold" });
  });

  it("offers payment while the hold is outstanding, and says when a payment did not go through", () => {
    expect(stepOf(checkout({ hold: hold("outstanding") }))).toEqual({
      kind: "pay",
      notCompleted: false,
    });
    expect(stepOf(checkout({ hold: hold("outstanding"), payment: payment("open") }))).toEqual({
      kind: "pay",
      notCompleted: false,
    });
    for (const status of ["cancelled", "expired"] as const) {
      expect(stepOf(checkout({ hold: hold("outstanding"), payment: payment(status) }))).toEqual({
        kind: "pay",
        notCompleted: true,
      });
    }
    expect(
      stepOf(checkout({ hold: hold("outstanding"), payment: payment("open") }), {
        returned: "cancelled",
      }),
    ).toEqual({ kind: "pay", notCompleted: true });
  });

  it("waits while a payment is verified and the ticket issued", () => {
    const outstanding = { hold: hold("outstanding") };
    expect(
      stepOf(checkout({ ...outstanding, payment: payment("open") }), { returned: "paid" }),
    ).toEqual({ kind: "processing" });
    expect(stepOf(checkout({ ...outstanding, payment: payment("paid") }))).toEqual({
      kind: "processing",
    });
    expect(stepOf(checkout({ hold: hold("issuing"), payment: payment("paid") }))).toEqual({
      kind: "processing",
    });
    for (const status of ["issuing", "failed"] as const) {
      expect(
        stepOf(checkout({ hold: hold("issuing"), sale: { status, ticket: null, cursor: null } })),
      ).toEqual({ kind: "processing" });
    }
  });

  it("confirms the ticket once the ledger recorded it", () => {
    expect(
      stepOf(
        checkout({
          hold: hold("confirmed"),
          payment: payment("paid"),
          sale: { status: "issued", ticket: "ee".repeat(32), cursor: "42" },
        }),
      ),
    ).toEqual({ kind: "done", ticket: "ee".repeat(32), cursor: "42" });
  });

  it("tells a buyer who paid and got no ticket that a refund is owed", () => {
    expect(
      stepOf(
        checkout({
          hold: hold("released"),
          payment: payment("paid"),
          sale: { status: "rejected", ticket: null, cursor: null },
          refund: { amount: 4_500_000, asset: "COPM/2", reason: "issuance-rejected" },
        }),
      ),
    ).toEqual({ kind: "refund", amount: 4_500_000, asset: "COPM/2" });
  });

  it("AC-B4.3: ends with no ticket and no charge once the hold is released or lapsed", () => {
    for (const status of ["released", "lapsed"] as const) {
      expect(stepOf(checkout({ hold: hold(status), payment: payment("cancelled") }))).toEqual({
        kind: "ended",
      });
    }
  });
});

describe("the checkout summary", () => {
  it("names what is bought, at the price the hold was placed at", () => {
    const summary = summaryOf(
      checkout({ placement: { kind: "Seated", position: "A-1" }, hold: hold("outstanding") }),
      {
        id: "ab".repeat(32),
        name: "Autumn Gala",
        description: null,
        organiser: null,
        venue: null,
        sessions: [],
        image: null,
        seatMaps: [],
        zones: [{ id: "01".repeat(32), name: "Stalls", kind: "Seated" }],
        status: "Active",
        closed: null,
      },
      {
        event: "ab".repeat(32),
        onSale: true,
        asset: "COPM/2",
        available: 10,
        classes: [
          {
            id: "c1".repeat(32),
            name: "General",
            description: null,
            price: 9_900,
            policy: { kind: "Single" },
            available: 10,
          },
        ],
        zones: [],
      },
    );
    expect(summary).toEqual({
      event: "ab".repeat(32),
      eventName: "Autumn Gala",
      zoneName: "Stalls",
      seat: "A-1",
      className: "General",
      price: "45,000.00 COPM",
    });
  });

  it("writes prices only in an asset it knows, and counts whole minutes left", () => {
    expect(priceOf(100, "DUSD/6")).toBe("0.000100 DUSD");
    expect(priceOf(100, "XYZ/9")).toBeNull();
    expect(priceOf(null, "COPM/2")).toBeNull();
    const now = new Date("2026-09-14T20:00:00.000Z");
    expect(minutesLeft("2026-09-14T20:14:59.000Z", now)).toBe(14);
    expect(minutesLeft("2026-09-14T19:59:00.000Z", now)).toBe(0);
  });
});
