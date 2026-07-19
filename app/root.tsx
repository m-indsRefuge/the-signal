import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { SpaceBackground } from "./components/space-background";
import "./app.css";
import "./site-background.css";

export const links: Route.LinksFunction = () => [
  {
    rel: "icon",
    type: "image/svg+xml",
    href: "/favicon.svg",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="signal">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#07080a" />
        <Meta />
        <Links />
      </head>

      <body>
        <SpaceBackground />

        <a className="skip-link" href="#main-content">
          Skip to content
        </a>

        {children}

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let code = "SYSTEM";
  let message = "Signal interrupted.";
  let details = "An unexpected fault crossed the public interface.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    code = String(error.status);
    message = error.status === 404 ? "Coordinate not found." : "Interface fault.";
    details =
      error.status === 404
        ? "The requested coordinate does not exist within the current archive."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main id="main-content" className="error-surface">
      <section className="error-panel" aria-labelledby="error-title">
        <p className="eyebrow">THE SIGNAL / EXCEPTION</p>
        <p className="error-code">{code}</p>

        <h1 id="error-title">{message}</h1>
        <p>{details}</p>

        <a className="signal-link" href="/">
          Return to the carrier
        </a>

        {stack && (
          <details className="error-diagnostics">
            <summary>Development diagnostics</summary>
            <pre>
              <code>{stack}</code>
            </pre>
          </details>
        )}
      </section>
    </main>
  );
}
