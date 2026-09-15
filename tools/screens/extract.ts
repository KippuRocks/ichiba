// Reads the screens and navigation declared in Ichiba's sources: where each screen is
// rendered, every edge from one screen to another, and everything that navigates or
// renders a route without declaring it.
//
// A screen is rendered as `<Screen id="home">`, with the id as a string literal, in a
// file under `src/app/`: the route that file belongs to is the screen's route. Every
// route renders at least one, in its `page.tsx` or a component beside it, and
// `not-found.tsx` renders one itself.
//
// An edge is declared by one of three forms, each naming both ends literally:
//
//   <ScreenLink from="home" to="event.detail" params={…}>   a link
//   navigate("checkout.pay", "checkout.done", { event })    a redirect from server code
//   transition("checkout.account", "saifu:checkout.link")   a change of screen the router
//                                                           does not make, or a handoff to
//                                                           another app's screen
//
// `from` may be a chrome, written `chrome:<id>`: its edges belong to every screen shown
// inside that chrome. Anything else that navigates — an `<a href>`, next/link's `<Link>`,
// `redirect`, `useRouter`, a write to `location`, `hrefOf` outside the screens module —
// is reported, so no transition escapes the manifest.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parseSync } from "oxc-parser";

export interface Edge {
  readonly from: string;
  readonly to: string;
  readonly file: string;
  readonly line: number;
}

/** A `<Screen id>` rendered in a source file. */
export interface Rendered {
  readonly id: string;
  readonly file: string;
  readonly line: number;
}

export interface Problem {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

export interface Extracted {
  readonly edges: readonly Edge[];
  readonly rendered: readonly Rendered[];
  readonly problems: readonly Problem[];
  /** Directories under `src/app/`, relative to the repository root, that hold a `page.tsx`. */
  readonly pageDirectories: ReadonlySet<string>;
}

interface Node {
  readonly type: string;
  readonly start: number;
  readonly [key: string]: unknown;
}

const DECLARING_CALLS = new Set(["navigate", "transition"]);

/** Navigation primitives only the screens module may use. */
const UNDECLARED_CALLS = new Set(["redirect", "permanentRedirect", "useRouter", "hrefOf"]);

/** The module that implements navigation, and may therefore use its primitives. */
const SCREENS_MODULE = /^src\/screens\//;

export const APP_DIRECTORY = "src/app";

/** Route files that must render a screen themselves; a page may render its screens through its components. */
const ROUTE_FILES = new Set(["not-found.tsx"]);

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

function children(node: Node): Node[] {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === "parent") return [];
    if (Array.isArray(value)) return value.filter(isNode);
    return isNode(value) ? [value] : [];
  });
}

function stringLiteral(node: unknown): string | null {
  if (!isNode(node)) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "JSXExpressionContainer") return stringLiteral(node.expression);
  return null;
}

function jsxName(node: Node): string | null {
  const name = node.name as Node | undefined;
  return name?.type === "JSXIdentifier" ? (name.name as string) : null;
}

function attribute(opening: Node, name: string): Node | null {
  const attributes = (opening.attributes as Node[] | undefined) ?? [];
  return (
    attributes.find((entry) => entry.type === "JSXAttribute" && jsxName(entry) === name) ?? null
  );
}

function lineOf(content: string, offset: number): number {
  return content.slice(0, offset).split("\n").length;
}

/** Edges, rendered screens and problems in one source file. `file` is relative to the repository root. */
export function extractFile(file: string, content: string): Omit<Extracted, "pageDirectories"> {
  const edges: Edge[] = [];
  const rendered: Rendered[] = [];
  const problems: Problem[] = [];
  const result = parseSync(file, content);
  for (const error of result.errors) {
    problems.push({ file, line: 1, message: `cannot parse: ${error.message}` });
  }
  const insideScreens = SCREENS_MODULE.test(file);
  const insideApp = file.startsWith(`${APP_DIRECTORY}/`);

  const visit = (node: Node) => {
    const line = lineOf(content, node.start);
    if (node.type === "JSXOpeningElement") {
      const name = jsxName(node);
      if (name === "Screen" && !insideScreens) {
        const id = stringLiteral(attribute(node, "id")?.value);
        if (id === null) {
          problems.push({ file, line, message: "Screen must name its `id` as a string literal" });
        } else if (!insideApp) {
          problems.push({
            file,
            line,
            message: `Screen "${id}" is rendered outside ${APP_DIRECTORY}/, where no route is known`,
          });
        } else {
          rendered.push({ id, file, line });
        }
      } else if (name === "ScreenLink") {
        const from = stringLiteral(attribute(node, "from")?.value);
        const to = stringLiteral(attribute(node, "to")?.value);
        if (from === null || to === null) {
          problems.push({
            file,
            line,
            message: "ScreenLink must name `from` and `to` as string literals",
          });
        } else {
          edges.push({ from, to, file, line });
        }
      } else if (name === "a" && attribute(node, "href") !== null && !insideScreens) {
        problems.push({
          file,
          line,
          message: "navigate with ScreenLink, not <a href>, so the edge is declared",
        });
      } else if (name === "Link" && !insideScreens) {
        problems.push({
          file,
          line,
          message: "navigate with ScreenLink, not <Link>, so the edge is declared",
        });
      }
    }
    if (node.type === "CallExpression") {
      const callee = node.callee as Node;
      const name = callee.type === "Identifier" ? (callee.name as string) : null;
      if (name !== null && DECLARING_CALLS.has(name) && !insideScreens) {
        const [from, to] = (node.arguments as Node[]).map(stringLiteral);
        if (from === null || from === undefined || to === null || to === undefined) {
          problems.push({
            file,
            line,
            message: `${name} must name both screens as string literals`,
          });
        } else {
          edges.push({ from, to, file, line });
        }
      }
      if (name !== null && UNDECLARED_CALLS.has(name) && !insideScreens) {
        problems.push({
          file,
          line,
          message: `${name} is for the screens module; use ScreenLink, navigate or transition`,
        });
      }
    }
    if (node.type === "MemberExpression" && !insideScreens) {
      const property = node.property as Node;
      if (
        property.type === "Identifier" &&
        (property.name === "location" || property.name === "history")
      ) {
        problems.push({
          file,
          line,
          message: `window.${property.name as string} is for the screens module; use navigate`,
        });
      }
    }
    for (const child of children(node)) visit(child);
  };
  visit(result.program as unknown as Node);

  if (insideApp && ROUTE_FILES.has(basename(file)) && rendered.length === 0) {
    problems.push({ file, line: 1, message: "a route file renders no <Screen id>" });
  }
  return { edges, rendered, problems };
}

function sourceFiles(root: string, directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(root, path);
    if (![".ts", ".tsx"].includes(extname(entry.name)) || /\.test\.tsx?$/.test(entry.name))
      return [];
    return [path];
  });
}

/** Edges, rendered screens and problems across every source file under `directory`. */
export function extract(root: string, directory = "src"): Extracted {
  const edges: Edge[] = [];
  const rendered: Rendered[] = [];
  const problems: Problem[] = [];
  const pageDirectories = new Set<string>();
  for (const file of sourceFiles(root, directory).sort()) {
    const found = extractFile(file, readFileSync(join(root, file), "utf8"));
    edges.push(...found.edges);
    rendered.push(...found.rendered);
    problems.push(...found.problems);
    if (file.startsWith(`${APP_DIRECTORY}/`) && basename(file) === "page.tsx") {
      pageDirectories.add(dirname(file));
    }
  }
  if (!existsSync(join(root, APP_DIRECTORY))) {
    problems.push({ file: APP_DIRECTORY, line: 1, message: "no app router directory" });
  }
  return { edges, rendered, problems, pageDirectories };
}
