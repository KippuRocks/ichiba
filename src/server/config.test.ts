import { afterEach, describe, expect, it } from "vitest";
import { publicUrl, saifuCheckoutLink, saifuLinkBase } from "./config.ts";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("configuration", () => {
  it("links a checkout's handoff into Saifu with the token in the fragment", () => {
    delete process.env.SAIFU_LINK_BASE;
    expect(saifuCheckoutLink("abc")).toBe("https://saifu.kippu.example/checkout#abc");
    process.env.SAIFU_LINK_BASE = "https://saifu.example.org";
    expect(saifuCheckoutLink("abc")).toBe("https://saifu.example.org/checkout#abc");
  });

  it("refuses a Saifu link base that is not an https origin", () => {
    for (const value of ["http://saifu.example.org", "https://saifu.example.org/app", "saifu"]) {
      process.env.SAIFU_LINK_BASE = value;
      expect(() => saifuLinkBase(), value).toThrow();
    }
  });

  it("defaults Ichiba's public origin to the local server, and refuses a path", () => {
    delete process.env.ICHIBA_PUBLIC_URL;
    expect(publicUrl()).toBe("http://localhost:3000");
    process.env.ICHIBA_PUBLIC_URL = "https://ichiba.example.org/shop";
    expect(() => publicUrl()).toThrow();
  });
});
