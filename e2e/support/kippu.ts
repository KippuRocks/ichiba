import { randomBytes, randomUUID } from "node:crypto";
import type { AppRouter } from "@kippu/api";
import type { Page } from "@playwright/test";
import { createTRPCClient, httpLink } from "@trpc/client";

/** The test API, as `playwright.config.ts` starts it. */
export const API_URL = `http://127.0.0.1:${process.env.KIPPU_API_PORT ?? "8080"}`;

/** Ichiba's origin: one kippu-api accepts login ceremonies from, on `localhost`. */
const ICHIBA_ORIGIN = "http://localhost:3000";

/** A client for the test API, as an organiser when given a session token. */
export function api(token?: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: `${API_URL}/v0/trpc`,
        headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
      }),
    ],
  });
}

/**
 * Signs a new organiser up, for a test to create the events it browses. The
 * passkey ceremony runs in `page`, which must have a virtual authenticator, at
 * Ichiba's origin; Ichiba itself signs nobody in. Answers the session token.
 */
export async function signUpOrganiser(page: Page): Promise<string> {
  const client = api();
  const challenge = await client.auth.organiser.beginSignUp.mutate({
    email: `organiser-${randomUUID()}@example.com`,
  });
  await page.goto(`${ICHIBA_ORIGIN}/`);
  const credential = await page.evaluate(async (options) => {
    const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(options as never);
    const created = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential;
    return created.toJSON();
  }, challenge.options);
  const signedUp = await client.auth.organiser.completeSignUp.mutate({
    ceremonyId: challenge.ceremonyId,
    credential: credential as never,
  });
  return signedUp.session.token;
}

export interface SeedZone {
  readonly name: string;
  readonly kind: "Seated" | "Unseated";
  /** A seated zone's canonical seat positions. */
  readonly seats?: readonly string[];
}

export interface SeededEvent {
  readonly event: string;
  readonly zones: readonly (SeedZone & { readonly id: string })[];
  /** The `Purchased` class's id, when one was defined. */
  readonly purchasedClass: string | null;
}

/**
 * Creates an event on the ledger through the test API, writes its public
 * document, and waits until Kippu's derived copy reflects it.
 */
export async function createEvent(
  token: string,
  details: {
    readonly zones: readonly SeedZone[];
    readonly capacity?: number;
    /** A `Purchased` class to define, which puts the event on sale; none by default. */
    readonly purchasedClass?: string;
    readonly document: (event: string, zones: SeededEvent["zones"]) => Record<string, unknown>;
  },
): Promise<SeededEvent> {
  const client = api(token);
  const zones = details.zones.map((zone) => ({ ...zone, id: randomBytes(32).toString("hex") }));
  const created = await client.events.create.mutate({
    zones: zones.map(({ id, kind }) => ({ id, kind })),
    capacity: details.capacity ?? null,
  });
  await client.metadata.events.put.mutate({
    event: created.event,
    document: details.document(created.event, zones) as never,
  });
  for (const zone of zones) {
    if (zone.seats !== undefined) {
      await client.events.zones.addSeatPositions.mutate({
        event: created.event,
        zone: zone.id,
        positions: [...zone.seats],
      });
    }
  }
  let purchasedClass: string | null = null;
  if (details.purchasedClass !== undefined) {
    const defined = await client.events.classes.define.mutate({
      event: created.event,
      name: details.purchasedClass,
      description: null,
      provenance: "Purchased",
      policy: { kind: "Single" },
      restrictions: { cannotResale: false, cannotTransfer: false },
      quota: null,
    });
    purchasedClass = defined.id;
  }
  const waited = await client.derived.waitFor.query({ cursor: created.cursor, timeout: 10_000 });
  if (!waited.reached) {
    throw new Error(`the derived copy did not reach ${created.cursor}`);
  }
  return { event: created.event, zones, purchasedClass };
}

/**
 * Places a hold the way checkout does (`sales.checkout.begin`, then `hold`), for a
 * buyer whose holder session is `holderToken`: begun with the holder's session,
 * the checkout is linked at once. Answers the hold's outcome.
 */
export async function placeHold(
  holderToken: string,
  input: {
    readonly event: string;
    readonly zone: string;
    readonly class: string;
    readonly seat?: string;
  },
) {
  const client = api(holderToken);
  const { token } = await client.sales.checkout.begin.mutate({
    event: input.event,
    zone: input.zone,
    class: input.class,
    placement:
      input.seat === undefined ? { kind: "Unseated" } : { kind: "Seated", position: input.seat },
  });
  return client.sales.checkout.hold.mutate({ token });
}
