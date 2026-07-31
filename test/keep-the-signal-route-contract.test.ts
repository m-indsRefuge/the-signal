import playerSource from "../app/features/keep-the-signal/player/keep-the-signal-player.tsx?raw";
import routesSource from "../app/routes.ts?raw";
import gameRouteSource from "../app/routes/keep-the-signal.tsx?raw";
import homeSource from "../app/routes/home.tsx?raw";

import { describe, expect, it } from "vitest";

describe("Keep the Signal KTS-I3 route contract", () => {
  it("registers the dedicated Keep the Signal route", () => {
    expect(routesSource).toContain('route("keep-the-signal", "routes/keep-the-signal.tsx")');
  });

  it("keeps the home index route registered", () => {
    expect(routesSource).toContain('index("routes/home.tsx")');
  });

  it("marks the home module online", () => {
    expect(homeSource).toMatch(/id:\s*"keep-the-signal"[\s\S]*?state:\s*"online"/);
  });

  it("describes the deterministic encounter as playable", () => {
    expect(homeSource).toMatch(
      /id:\s*"keep-the-signal"[\s\S]*?description:[\s\S]*?deterministic encounter is playable/i,
    );
  });

  it("links the home module to the dedicated route", () => {
    expect(homeSource).toContain('href: "/keep-the-signal"');
    expect(homeSource).toContain('className="module-card__action"');
  });

  it("preserves the Archive module state", () => {
    expect(homeSource).toMatch(/id:\s*"archive"[\s\S]*?state:\s*"receiving"/);
  });

  it("preserves the Dev-Journal module state", () => {
    expect(homeSource).toMatch(/id:\s*"dev-journal"[\s\S]*?state:\s*"open"/);
  });

  it("preserves the Transmissions module state", () => {
    expect(homeSource).toMatch(/id:\s*"transmissions"[\s\S]*?state:\s*"forming"/);
  });

  it("defines the canonical game-route title and description", () => {
    expect(gameRouteSource).toContain('const title = "Keep the Signal — The Signal"');
    expect(gameRouteSource).toContain('{ name: "description", content: description }');
  });

  it("defines Open Graph identity for the game route", () => {
    expect(gameRouteSource).toContain('{ property: "og:title", content: title }');
    expect(gameRouteSource).toContain('{ property: "og:description", content: description }');
  });

  it("provides an accessible game identity", () => {
    expect(playerSource).toContain('aria-labelledby="kts-player-title"');
    expect(playerSource).toContain('<h1 id="kts-player-title">Keep the Signal</h1>');
  });

  it("provides labelled movement and operator controls", () => {
    expect(playerSource).toContain('aria-label="Movement controls"');
    expect(playerSource).toContain('aria-labelledby="kts-controls-title"');
    expect(playerSource).toContain('aria-labelledby="kts-power-controls-title"');
  });

  it("provides a DOM state mirror and live announcements", () => {
    expect(playerSource).toContain("snapshot.hud.accessibleSummary");
    expect(playerSource).toContain('aria-live="polite"');
    expect(playerSource).toContain('aria-atomic="true"');
  });

  it("provides a clear return route to The Signal", () => {
    expect(playerSource).toContain('href="/" aria-label="Return to The Signal"');
    expect(gameRouteSource).toContain('<a href="/">Return to The Signal</a>');
  });
});
