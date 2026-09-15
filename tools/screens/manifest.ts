// Builds `screens.json`: Ichiba's screen manifest (F-070 plan §5.4).

import { basename, dirname } from "node:path";
import { CHROME, EXTERNAL_APPS, SCREENS } from "../../src/screens/registry.ts";
import { routeOfDirectory } from "../../src/screens/routes.ts";
import {
  APP_DIRECTORY,
  type Edge,
  type Extracted,
  type Problem,
  type Rendered,
} from "./extract.ts";

/** One screen of the manifest. */
export interface ManifestScreen {
  readonly screenId: string;
  /** The route the screen is shown at, as an app router path pattern; `null` when it has no URL of its own. */
  readonly route: string | null;
  readonly title: string;
  /** The screens this screen can navigate to, sorted; another app's screen is `<app>:<screenId>`. */
  readonly navigatesTo: readonly string[];
}

export interface Manifest {
  readonly format: "kippu.screens/1";
  readonly app: "ichiba";
  readonly platform: "web";
  /** In the registry's declaration order. */
  readonly screens: readonly ManifestScreen[];
}

type Registry = Readonly<
  Record<
    string,
    { readonly title: string; readonly route: string | null; readonly chrome: string | null }
  >
>;

const EXTERNAL = new RegExp(`^(${EXTERNAL_APPS.join("|")}):[a-z0-9]+(?:[.-][a-z0-9]+)*$`);

/**
 * The route the screen rendered in `file` is shown at: that of the nearest
 * directory, from the file's own upwards, holding a `page.tsx`. A root
 * `not-found.tsx` is shown at any URL that names nothing, so it has none.
 */
export function routeOfFile(file: string, pageDirectories: ReadonlySet<string>): string | null {
  const directory = pageDirectoryOf(file, pageDirectories);
  if (directory === null) return null;
  return routeOfDirectory(directory.slice(APP_DIRECTORY.length).split("/").filter(Boolean));
}

function pageDirectoryOf(file: string, pageDirectories: ReadonlySet<string>): string | null {
  if (basename(file) === "not-found.tsx" && dirname(file) === APP_DIRECTORY) return null;
  let directory = dirname(file);
  while (directory.startsWith(APP_DIRECTORY)) {
    if (pageDirectories.has(directory)) return directory;
    directory = dirname(directory);
  }
  return null;
}

export function buildManifest(
  extracted: Extracted,
  screens: Registry = SCREENS,
  chrome: Readonly<Record<string, unknown>> = CHROME,
): { manifest: Manifest; problems: readonly Problem[] } {
  const problems: Problem[] = [...extracted.problems];
  const targets = new Map<string, Set<string>>(Object.keys(screens).map((id) => [id, new Set()]));

  const renderedIds = new Set<string>();
  const coveredPages = new Set<string>();
  const checkRendered = ({ id, file, line }: Rendered) => {
    const page = pageDirectoryOf(file, extracted.pageDirectories);
    if (page !== null) coveredPages.add(page);
    const screen = screens[id];
    if (screen === undefined) {
      problems.push({ file, line, message: `Screen "${id}" is not in the registry` });
      return;
    }
    renderedIds.add(id);
    const route = routeOfFile(file, extracted.pageDirectories);
    if (route !== screen.route) {
      problems.push({
        file,
        line,
        message: `Screen "${id}" is rendered at route ${JSON.stringify(route)}, but the registry says ${JSON.stringify(screen.route)}`,
      });
    }
  };
  extracted.rendered.forEach(checkRendered);
  for (const page of [...extracted.pageDirectories].sort()) {
    if (!coveredPages.has(page)) {
      problems.push({
        file: `${page}/page.tsx`,
        line: 1,
        message: "a route renders no <Screen id>",
      });
    }
  }
  for (const id of Object.keys(screens)) {
    if (!renderedIds.has(id)) {
      problems.push({
        file: "src/screens/registry.ts",
        line: 1,
        message: `screen "${id}" is never rendered`,
      });
    }
  }

  const known = (edge: Edge, end: "from" | "to"): boolean => {
    const id = edge[end];
    const isChrome = end === "from" && id.startsWith("chrome:") && id.slice(7) in chrome;
    const isExternal = end === "to" && EXTERNAL.test(id);
    if (!isChrome && !isExternal && !(id in screens)) {
      problems.push({ file: edge.file, line: edge.line, message: `unknown ${end} screen "${id}"` });
      return false;
    }
    return true;
  };

  for (const edge of extracted.edges) {
    if (!known(edge, "from") || !known(edge, "to")) continue;
    const sources = edge.from.startsWith("chrome:")
      ? Object.entries(screens)
          .filter(([, screen]) => screen.chrome === edge.from.slice(7))
          .map(([id]) => id)
      : [edge.from];
    for (const source of sources) {
      if (source !== edge.to) targets.get(source)?.add(edge.to);
    }
  }

  return {
    manifest: {
      format: "kippu.screens/1",
      app: "ichiba",
      platform: "web",
      screens: Object.entries(screens).map(([screenId, screen]) => ({
        screenId,
        route: screen.route,
        title: screen.title,
        navigatesTo: [...(targets.get(screenId) ?? [])].sort(),
      })),
    },
    problems,
  };
}

export function serialise(manifest: Manifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}
