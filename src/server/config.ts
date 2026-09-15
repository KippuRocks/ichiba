/**
 * Ichiba's configuration, read at request time. No hostname is chosen yet, so
 * every default is a local or placeholder origin.
 */

function origin(name: string, value: string, protocols: readonly string[]): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a URL`);
  }
  if (!protocols.includes(url.protocol) || url.origin !== value) {
    throw new Error(`${name} must be an ${protocols.join(" or ")} origin, with no path`);
  }
  return url.origin;
}

/**
 * Ichiba's own public origin (`ICHIBA_PUBLIC_URL`): the payment provider sends
 * the buyer back to it. Defaults to the local server.
 */
export function publicUrl(): string {
  return origin("ICHIBA_PUBLIC_URL", process.env.ICHIBA_PUBLIC_URL ?? "http://localhost:3000", [
    "https:",
    "http:",
  ]);
}

/**
 * Where Saifu's links live (`SAIFU_LINK_BASE`): an https origin whose host
 * vouches for Saifu, so its links open the app. A placeholder until the
 * hostname is chosen.
 */
export function saifuLinkBase(): string {
  return origin("SAIFU_LINK_BASE", process.env.SAIFU_LINK_BASE ?? "https://saifu.kippu.example", [
    "https:",
  ]);
}

/** The link that opens a checkout's handoff in Saifu: the handoff token rides in the fragment. */
export function saifuCheckoutLink(handoffToken: string): string {
  return `${saifuLinkBase()}/checkout#${handoffToken}`;
}
