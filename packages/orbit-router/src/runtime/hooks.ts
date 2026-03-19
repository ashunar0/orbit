import { useRouterContext } from "./router";

export function useParams(): Record<string, string> {
  return useRouterContext().params;
}
