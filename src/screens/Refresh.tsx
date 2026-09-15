"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Renders the current route again on the server every `every` ms, while a
 * screen waits for something that happens elsewhere — Saifu linking, a payment
 * being verified, a ticket being issued. Which screen follows is the server's to
 * decide, and every transition it can make is declared with `transition`.
 */
export function Refresh({ every }: { every: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), every);
    return () => clearInterval(timer);
  }, [router, every]);
  return null;
}
