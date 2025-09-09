import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/podcast")({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/podcast"!</div>;
}

