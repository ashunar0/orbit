import { routes } from "virtual:orbit-router/routes";
import { Router } from "orbit-router";

export function App() {
  return <Router routes={routes} />;
}
