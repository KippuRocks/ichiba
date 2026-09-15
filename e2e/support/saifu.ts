import { createHash, randomBytes, randomUUID } from "node:crypto";
import pg from "pg";

/**
 * The test API's Kippu store, as `tools/test-api.sh` gives it: CI's service
 * container, or the local database the script recreates.
 */
const DATABASE_URL =
  process.env.KIPPU_DATABASE_URL ??
  "postgres://kippu_api:kippu_api_local@127.0.0.1:54329/ichiba_e2e";

/**
 * A stand-in for Saifu's half of checkout (`F-060` plan §7, "a Saifu handoff
 * stub"): a holder session for a fresh account, as linking would open one.
 *
 * Saifu opens a holder session by proving control of a credential registered on
 * the ledger (`auth.holder.completeLink`). kippu-api's development wiring keeps
 * its ledger inside its own process, where no other process can register a
 * credential, so this writes the session straight into the test API's store, in
 * the shape kippu-api's migrations `0002` and `0004` give it. Test data only:
 * the store is recreated for every test API run, and Ichiba itself never holds
 * or opens a holder session. Answers the bearer token and the account.
 */
export async function holderSession(): Promise<{ token: string; account: string }> {
  const token = randomBytes(32).toString("base64url");
  const account = randomBytes(32).toString("hex");
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const now = new Date();
    await client.query(
      "INSERT INTO holders (account, created_at, last_linked_at) VALUES ($1, $2, $2)",
      [account, now],
    );
    await client.query(
      `INSERT INTO sessions (id, token_hash, principal_kind, holder_account, created_at, expires_at)
       VALUES ($1, $2, 'holder', $3, $4, $5)`,
      [
        randomUUID(),
        createHash("sha256").update(token, "utf8").digest(),
        account,
        now,
        new Date(now.getTime() + 60 * 60 * 1000),
      ],
    );
  } finally {
    await client.end();
  }
  return { token, account };
}
