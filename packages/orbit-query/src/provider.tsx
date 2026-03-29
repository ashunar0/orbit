import { createContext, use, type ReactNode } from "react";
import type { QueryClient } from "./types";

const QueryClientContext = createContext<QueryClient | null>(null);

export function QueryProvider(props: { client: QueryClient; children: ReactNode }) {
  return <QueryClientContext value={props.client}>{props.children}</QueryClientContext>;
}

export function useQueryClient(): QueryClient {
  const client = use(QueryClientContext);
  if (!client) {
    throw new Error("useQueryClient must be used within a <QueryProvider>");
  }
  return client;
}
