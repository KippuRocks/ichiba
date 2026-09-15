import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

export interface ManifestScreen {
  readonly screenId: string;
  readonly route: string | null;
  readonly title: string;
  readonly navigatesTo: readonly string[];
}

export const manifest = JSON.parse(readFileSync("screens.json", "utf8")) as {
  readonly screens: readonly ManifestScreen[];
};

export const byId = new Map(manifest.screens.map((screen) => [screen.screenId, screen]));

/**
 * Follows Ichiba through its screens, checking at every step that exactly one
 * screen id is rendered, that it is the expected one and is in the manifest, and
 * that the transition taken is one the manifest declares. `enter` starts from a
 * URL typed in, which is no transition.
 */
export class Walk {
  readonly visited = new Set<string>();
  private current: string | null = null;

  constructor(private readonly page: Page) {}

  async enter(url: string, screenId: string): Promise<void> {
    await this.page.goto(url);
    this.current = null;
    await this.on(screenId);
  }

  /**
   * Goes to `url` within the flow, as the payment provider sends the buyer back:
   * the change from the current screen must still be declared.
   */
  async arrive(url: string, screenId: string): Promise<void> {
    await this.page.goto(url);
    await this.on(screenId);
  }

  async on(screenId: string, options: { readonly timeout?: number } = {}): Promise<void> {
    expect(byId.get(screenId), `${screenId} is in screens.json`).toBeDefined();
    await expect(this.page.locator(`[data-screen="${screenId}"]`)).toBeVisible(options);
    await expect(this.page.locator("[data-screen]")).toHaveCount(1);
    if (this.current !== null && this.current !== screenId) {
      expect(byId.get(this.current)?.navigatesTo, `${this.current} → ${screenId}`).toContain(
        screenId,
      );
    }
    this.current = screenId;
    this.visited.add(screenId);
  }
}
