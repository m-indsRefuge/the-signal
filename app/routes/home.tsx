import { env } from "cloudflare:workers";

import type { Route } from "./+types/home";
import { readRequiredBinding } from "../platform/runtime.server";
import { Welcome } from "../welcome/welcome";

export function meta() {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export function loader() {
  return {
    message: readRequiredBinding("VALUE_FROM_CLOUDFLARE", env.VALUE_FROM_CLOUDFLARE),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <Welcome message={loaderData.message} />;
}
