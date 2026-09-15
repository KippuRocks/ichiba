import type { ReactNode } from "react";
import type { ScreenId } from "./registry.ts";

/**
 * A screen's root: carries its `screenId` in the rendered tree as `data-screen`
 * (`F-070` plan §5.4), so a test can tell which screen it is on without reading
 * copy. Rendered only in `src/app/`, with the id as a string literal, where
 * `tools/screens` checks it against the route of the file.
 */
export function Screen({ id, children }: { id: ScreenId; children: ReactNode }) {
  return (
    <div data-screen={id} className="screen">
      {children}
    </div>
  );
}
