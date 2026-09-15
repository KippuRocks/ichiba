import type { Metadata } from "next";
import { Screen } from "../screens/Screen.tsx";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <Screen id="system.not-found">
      <h1>Page not found</h1>
      <p>There is nothing at this address.</p>
    </Screen>
  );
}
