import { describe, expect, it } from "vitest";
import { type Extracted, extractFile } from "./extract.ts";
import { buildManifest, routeOfFile } from "./manifest.ts";

const registry = {
  home: { title: "Home", route: "/", chrome: "site" },
  "event.detail": { title: "Event", route: "/events/:event", chrome: "site" },
  "checkout.one": { title: "One", route: "/events/:event/checkout", chrome: null },
  "checkout.two": { title: "Two", route: "/events/:event/checkout", chrome: null },
  "system.not-found": { title: "Not found", route: null, chrome: "site" },
};
const chrome = { site: {} };

function extractAll(files: Record<string, string>): Extracted {
  const parts = Object.entries(files).map(([file, content]) => extractFile(file, content));
  return {
    edges: parts.flatMap((part) => part.edges),
    rendered: parts.flatMap((part) => part.rendered),
    problems: parts.flatMap((part) => part.problems),
    pageDirectories: new Set(
      Object.keys(files)
        .filter((file) => file.endsWith("/page.tsx"))
        .map((file) => file.slice(0, -"/page.tsx".length)),
    ),
  };
}

const APP = {
  "src/app/page.tsx": `export default () => <Screen id="home"><ScreenLink from="home" to="event.detail" params={{ event }}>Open</ScreenLink></Screen>;`,
  "src/app/layout.tsx": `export default () => <ScreenLink from="chrome:site" to="home" params={{}}>Ichiba</ScreenLink>;`,
  "src/app/not-found.tsx": `export default () => <Screen id="system.not-found" />;`,
  "src/app/(shop)/events/[event]/page.tsx": `export default () => <Screen id="event.detail" />;`,
  "src/app/events/[event]/checkout/page.tsx": `export default () => <Steps />;`,
  "src/app/events/[event]/checkout/Steps.tsx": `
    export const Steps = () => step === 1
      ? <Screen id="checkout.one" />
      : <Screen id="checkout.two" />;
    const next = transition("checkout.one", "checkout.two");
    const done = () => navigate("checkout.two", "event.detail", { event });
    const handoff = transition("checkout.one", "saifu:checkout.link");
  `,
};

describe("the screen manifest", () => {
  it("records links, redirects, transitions and handoffs to Saifu as edges", () => {
    const extracted = extractAll(APP);
    const { manifest, problems } = buildManifest(extracted, registry, chrome);
    // The checkout page renders its screens through a component beside it.
    expect(problems).toEqual([]);
    expect(manifest).toEqual({
      format: "kippu.screens/1",
      app: "ichiba",
      platform: "web",
      screens: [
        { screenId: "home", route: "/", title: "Home", navigatesTo: ["event.detail"] },
        {
          screenId: "event.detail",
          route: "/events/:event",
          title: "Event",
          navigatesTo: ["home"],
        },
        {
          screenId: "checkout.one",
          route: "/events/:event/checkout",
          title: "One",
          navigatesTo: ["checkout.two", "saifu:checkout.link"],
        },
        {
          screenId: "checkout.two",
          route: "/events/:event/checkout",
          title: "Two",
          navigatesTo: ["event.detail"],
        },
        { screenId: "system.not-found", route: null, title: "Not found", navigatesTo: ["home"] },
      ],
    });
  });

  it("derives a screen's route from where it is rendered in the app router", () => {
    const pages = new Set(["src/app", "src/app/(shop)/events/[event]"]);
    expect(routeOfFile("src/app/page.tsx", pages)).toBe("/");
    expect(routeOfFile("src/app/not-found.tsx", pages)).toBeNull();
    expect(routeOfFile("src/app/(shop)/events/[event]/page.tsx", pages)).toBe("/events/:event");
    expect(routeOfFile("src/app/(shop)/events/[event]/parts/Seat.tsx", pages)).toBe(
      "/events/:event",
    );
  });

  it("CI fails when a route renders no screen id", () => {
    const extracted = extractAll({
      ...APP,
      "src/app/about/page.tsx": "export default () => <main />;",
      "src/app/about/Part.tsx": "export const Part = () => <p />;",
    });
    const { problems } = buildManifest(extracted, registry, chrome);
    expect(problems.map(({ file, message }) => `${file}: ${message}`)).toEqual([
      "src/app/about/page.tsx: a route renders no <Screen id>",
    ]);
    const notFound = extractFile("src/app/not-found.tsx", "export default () => <main />;");
    expect(notFound.problems.map(({ message }) => message)).toEqual([
      "a route file renders no <Screen id>",
    ]);
  });

  it("reports a screen rendered at a route other than the registry's, unregistered or never rendered", () => {
    const extracted = extractAll({
      "src/app/page.tsx": `export default () => <Screen id="event.detail" />;`,
      "src/app/not-found.tsx": `export default () => <Screen id="system.gone" />;`,
    });
    const { problems } = buildManifest(extracted, registry, chrome);
    expect(problems.map(({ message }) => message)).toEqual([
      'Screen "event.detail" is rendered at route "/", but the registry says "/events/:event"',
      'Screen "system.gone" is not in the registry',
      'screen "home" is never rendered',
      'screen "checkout.one" is never rendered',
      'screen "checkout.two" is never rendered',
      'screen "system.not-found" is never rendered',
    ]);
  });

  it("reports navigation that does not declare its edge, and ids that are not literal", () => {
    const { problems } = extractFile(
      "src/app/example.tsx",
      `
        const raw = <a href="/">Home</a>;
        const computed = <ScreenLink from={here} to="home" params={{}}>Home</ScreenLink>;
        navigate(where, "home", {});
        window.location.assign("/");
        const url = hrefOf("home", {});
        const link = <Link href="/">Home</Link>;
        redirect("/");
        const router = useRouter();
        const screen = <Screen id={which} />;
      `,
    );
    expect(problems.map(({ line, message }) => `${line}: ${message.split(" ")[0]}`)).toEqual([
      "2: navigate",
      "3: ScreenLink",
      "4: navigate",
      "5: window.location",
      "6: hrefOf",
      "7: navigate",
      "8: redirect",
      "9: useRouter",
      "10: Screen",
    ]);
  });

  it("reports a screen rendered outside the app router", () => {
    const { problems } = extractFile("src/parts/Probe.tsx", `const p = <Screen id="home" />;`);
    expect(problems.map(({ message }) => message)).toEqual([
      'Screen "home" is rendered outside src/app/, where no route is known',
    ]);
  });

  it("lets the screens module use the primitives it implements", () => {
    const { problems } = extractFile(
      "src/screens/navigation.ts",
      "export function navigate(from, to, params) { redirect(hrefOf(to, params)); }",
    );
    expect(problems).toEqual([]);
  });

  it("reports an edge to a screen the registry does not have, or to an unknown app", () => {
    const extracted = extractAll({
      "src/app/x.ts": `transition("home", "event.gone"); transition("home", "iriguchi:scan");`,
    });
    const { problems } = buildManifest(extracted, registry, chrome);
    expect(
      problems.map(({ message }) => message).filter((message) => message.startsWith("unknown")),
    ).toEqual(['unknown to screen "event.gone"', 'unknown to screen "iriguchi:scan"']);
  });
});
