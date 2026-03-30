import { routes, NotFound } from "virtual:orbit-router/routes";
import { Router } from "orbit-router";
import { QueryProvider, type QueryClient } from "orbit-query";

interface AppProps {
  queryClient: QueryClient;
  url?: string;
}

export function App({ queryClient, url }: AppProps) {
  return (
    <QueryProvider client={queryClient}>
      <Router routes={routes} NotFound={NotFound} url={url} />
    </QueryProvider>
  );
}
