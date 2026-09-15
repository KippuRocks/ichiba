"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * Shows `children` once a waiting screen has waited `after` ms, so a buyer is
 * told when something takes longer than it should. The screen keeps waiting:
 * this changes what it says, never what happens.
 */
export function SlowNotice({ after, children }: { after: number; children: ReactNode }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), after);
    return () => clearTimeout(timer);
  }, [after]);
  return slow ? (
    <p role="status" className="checkout-notice" data-testid="slow-notice">
      {children}
    </p>
  ) : null;
}
