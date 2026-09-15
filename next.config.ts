import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // `pnpm typecheck` runs TypeScript 7 over the whole repository, in CI as well; the
  // build does not type-check a second time.
  typescript: { ignoreBuildErrors: true },
};

export default config;
