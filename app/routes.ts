import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("keep-the-signal", "routes/keep-the-signal.tsx"),
] satisfies RouteConfig;
