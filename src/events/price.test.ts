import { describe, expect, it } from "vitest";
import { formatPrice } from "./price.ts";

describe("prices", () => {
  it("writes minor units with the asset's precision", () => {
    expect(formatPrice(1250000, "COPM/2")).toBe("12,500.00 COPM");
    expect(formatPrice(5, "COPM/2")).toBe("0.05 COPM");
    expect(formatPrice(100, "COPM/2")).toBe("1.00 COPM");
    expect(formatPrice(25_500_000, "DUSD/6")).toBe("25.500000 DUSD");
    expect(formatPrice(1, "DUSD/6")).toBe("0.000001 DUSD");
  });

  it("is exact where floating point is not", () => {
    // 0.1 + 0.2 in minor units, and the largest safe integer.
    expect(formatPrice(30, "COPM/2")).toBe("0.30 COPM");
    expect(formatPrice(Number.MAX_SAFE_INTEGER, "COPM/2")).toBe("90,071,992,547,409.91 COPM");
    expect(formatPrice(Number.MAX_SAFE_INTEGER, "DUSD/6")).toBe("9,007,199,254.740991 DUSD");
  });

  it("refuses what is not a price in minor units", () => {
    expect(() => formatPrice(1.5, "COPM/2")).toThrow(RangeError);
    expect(() => formatPrice(-1, "COPM/2")).toThrow(RangeError);
    expect(() => formatPrice(Number.MAX_SAFE_INTEGER + 2, "COPM/2")).toThrow(RangeError);
  });
});
