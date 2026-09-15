import type { SaleInventory } from "../server/kippu.ts";

/** An event's sale asset (`F-021` plan, "Prices"). */
export type SaleAsset = NonNullable<SaleInventory["asset"]>;

/** How each asset is written, and how many decimal places its minor units have. */
const ASSETS: Readonly<Record<SaleAsset, { readonly code: string; readonly decimals: number }>> = {
  "COPM/2": { code: "COPM", decimals: 2 },
  "DUSD/6": { code: "DUSD", decimals: 6 },
};

/**
 * A price in the asset's minor units, written with the asset's precision:
 * `1250000` in `COPM/2` is `12,500.00 COPM`. Exact: integer arithmetic on the
 * minor units, never floating point.
 */
export function formatPrice(minorUnits: number, asset: SaleAsset): string {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new RangeError(`a price is a non-negative safe integer, not ${minorUnits}`);
  }
  const { code, decimals } = ASSETS[asset];
  const scale = 10n ** BigInt(decimals);
  const units = BigInt(minorUnits);
  const whole = (units / scale).toLocaleString("en-GB");
  const fraction = (units % scale).toString().padStart(decimals, "0");
  return `${whole}.${fraction} ${code}`;
}
