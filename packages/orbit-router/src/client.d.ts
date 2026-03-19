declare module "virtual:orbit-router/routes" {
  import type { ComponentType } from "react";

  interface Route {
    path: string;
    component: ComponentType;
    layouts: ComponentType<{ children: React.ReactNode }>[];
    loader?: (args: { params: Record<string, string>; search: Record<string, string> }) => Promise<unknown>;
    action?: (args: { params: Record<string, string>; search: Record<string, string>; formData: FormData }) => Promise<unknown>;
    Loading?: ComponentType;
    ErrorBoundary?: ComponentType<{ error: Error }>;
  }

  export const routes: Route[];
}
