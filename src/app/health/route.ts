import { kippu } from "../../server/kippu";

export const dynamic = "force-dynamic";

/**
 * Operational health, outside any versioned prefix. Answers `ok` only while the
 * Kippu API answers Ichiba's server, since no page can render without it.
 */
export async function GET(): Promise<Response> {
  try {
    const api = await kippu().system.health.query();
    return Response.json({ status: "ok", api: api.status });
  } catch {
    return Response.json({ status: "unavailable", api: "unreachable" }, { status: 503 });
  }
}
