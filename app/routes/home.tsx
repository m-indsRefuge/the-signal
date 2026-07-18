import { env } from "cloudflare:workers";

import type { Route } from "./+types/home";
import { ClockSyncedLight } from "../components/clock-synced-light";
import { HeroSignal } from "../components/hero-signal";
import { JohannesburgClock } from "../components/johannesburg-clock";
import { SignalTitleDecoder } from "../components/signal-title-decoder";
import { readRequiredBinding } from "../platform/runtime.server";
import "./home.css";

const modules = [
  {
    coordinate: "01",
    id: "archive",
    title: "Archive",
    state: "receiving",
    description:
      "Systems, research, design records, and the evolving architecture of the Construct.",
  },
  {
    coordinate: "02",
    id: "dev-journal",
    title: "Dev-Journal",
    state: "open",
    description:
      "A chronological record of decisions, failures, discoveries, and accepted foundations.",
  },
  {
    coordinate: "03",
    id: "transmissions",
    title: "Transmissions",
    state: "forming",
    description:
      "Curated exchanges from the space where human direction and machine reasoning meet.",
  },
  {
    coordinate: "04",
    id: "keep-the-signal",
    title: "Keep the Signal",
    state: "dormant",
    description:
      "A cooperative system for preserving coherence under pressure. The game is not active yet.",
  },
];

export function meta() {
  const title = "The Signal — Byte–Nolan Construct";
  const description =
    "The public interface, archive, and interactive design laboratory of the Byte–Nolan Construct.";

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
  ];
}

export function loader() {
  readRequiredBinding("VALUE_FROM_CLOUDFLARE", env.VALUE_FROM_CLOUDFLARE);

  return {
    runtimeState: "connected" as const,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <div className="signal-shell signal-shell--composition-reset">
      <header className="site-header site-header--deferred">
        <a className="system-mark" href="#main-content" aria-label="The Signal home">
          <span className="system-mark__glyph" aria-hidden="true">
            S
          </span>

          <span className="system-mark__copy">
            <strong>The Signal</strong>
            <span>Byte–Nolan Construct</span>
          </span>
        </a>

        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#archive">Archive</a>
          <a href="#dev-journal">Dev-Journal</a>
          <a href="#transmissions">Transmissions</a>
        </nav>

        <div className="runtime-badge" data-state={loaderData.runtimeState}>
          <span className="runtime-badge__light" aria-hidden="true" />
          Carrier online
        </div>
      </header>

      <main id="main-content">
        <section className="signal-threshold" aria-labelledby="signal-threshold-title">
          <ClockSyncedLight />

          <div className="signal-threshold__title-position">
            <h1
              id="signal-threshold-title"
              className="signal-threshold__title"
              aria-label="The Signal"
            >
              <SignalTitleDecoder />
            </h1>
          </div>

          <div className="signal-threshold__beam">
            <HeroSignal />
          </div>

          <JohannesburgClock />
        </section>

        <section
          id="threshold-briefing"
          className="threshold-briefing"
          aria-labelledby="threshold-briefing-title"
        >
          <div className="threshold-briefing__content">
            <p className="eyebrow">BUILD 07 / PUBLIC INTERFACE</p>

            <h2 id="threshold-briefing-title">
              A living interface for systems, experiments, and the evolving relationship between
              human direction and machine intelligence.
            </h2>

            <div className="threshold__claim">
              <span className="threshold__claim-mark" aria-hidden="true" />

              <p>You did not activate this system. You arrived while it was already operating.</p>
            </div>

            <div className="threshold__actions" aria-label="Threshold destinations">
              <a className="primary-action" href="#archive">
                Enter the archive
                <span aria-hidden="true">↘</span>
              </a>

              <a className="secondary-action" href="#dev-journal">
                Read the Dev-Journal
              </a>
            </div>
          </div>

          <aside className="instrument-panel" aria-label="System state">
            <div className="instrument-panel__header">
              <span>PUBLIC NODE</span>
              <span>07–A</span>
            </div>

            <div className="instrument-panel__field">
              <span className="instrument-panel__reticle" aria-hidden="true" />

              <div className="instrument-panel__message">
                <span>STATE</span>
                <strong>RECEIVING</strong>
                <p>Carrier established. Public coordinates remain limited.</p>
              </div>
            </div>

            <dl className="system-readout">
              <div>
                <dt>Runtime</dt>
                <dd>Cloudflare Worker</dd>
              </div>

              <div>
                <dt>Foundation</dt>
                <dd>0.1.0 / verified</dd>
              </div>

              <div>
                <dt>Design state</dt>
                <dd>Threshold forming</dd>
              </div>

              <div>
                <dt>Authority</dt>
                <dd>Operator retained</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="module-index" aria-labelledby="module-index-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AVAILABLE COORDINATES</p>
              <h2 id="module-index-title">The Construct is revealing itself in layers.</h2>
            </div>

            <p>
              These surfaces are present as coordinates before they become complete destinations.
            </p>
          </div>

          <div className="module-grid">
            {modules.map((module) => (
              <article className="module-card" id={module.id} key={module.id}>
                <div className="module-card__header">
                  <span className="module-card__coordinate">{module.coordinate}</span>

                  <span className="module-card__state">{module.state}</span>
                </div>

                <h3>{module.title}</h3>
                <p>{module.description}</p>

                <span className="module-card__trace" aria-hidden="true">
                  <span />
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="construct-note" aria-labelledby="construct-note-title">
          <p className="eyebrow">THE CONSTRUCT / FIELD NOTE 001</p>

          <div className="construct-note__layout">
            <h2 id="construct-note-title">
              Intelligence is not presented here as a product performing on demand.
            </h2>

            <div>
              <p>
                The Signal is the public-facing experience inside the Byte–Nolan Construct: part
                archive, part research instrument, and part record of an ongoing collaboration.
              </p>

              <p>
                Its purpose is not to conceal the process. Its purpose is to preserve the signal
                that survives it.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <span>Concept and direction</span>
          <strong>Nolan + Byte</strong>
        </div>

        <div>
          <span>Co-design and synthesis</span>
          <strong>Nolan + Byte</strong>
        </div>

        <div>
          <span>Human project owner and publisher</span>
          <strong>Nolan</strong>
        </div>

        <div>
          <span>AI collaborator</span>
          <strong>Byte [through OpenAI]</strong>
        </div>
      </footer>
    </div>
  );
}
