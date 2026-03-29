import { routes, NotFound } from "virtual:orbit-router/routes";
import { Router } from "orbit-router";
import { createQueryClient, QueryProvider } from "orbit-query";

const queryClient = createQueryClient();

export function App() {
  return (
    <QueryProvider client={queryClient}>
      <Router routes={routes} NotFound={NotFound} />
    </QueryProvider>
  );
}
