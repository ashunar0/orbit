declare module "virtual:orbit-router/routes" {
  import type { ComponentType, LazyExoticComponent } from "react";

  interface LayoutEntry {
    component: ComponentType<{ children: React.ReactNode }>;
    loader?: (args: { params: Record<string, string>; search: Record<string, string> }) => Promise<unknown>;
  }

  interface Route {
    path: string;
    component: ComponentType | LazyExoticComponent<ComponentType>;
    layouts: LayoutEntry[];
    loader?: (args: { params: Record<string, string>; search: Record<string, string> }) => Promise<unknown>;
    action?: (args: { params: Record<string, string>; search: Record<string, string>; data?: unknown; formData?: FormData }) => Promise<unknown>;
    Loading?: ComponentType;
    ErrorBoundary?: ComponentType<{ error: Error }>;
  }

  export const routes: Route[];
  export const NotFound: ComponentType | undefined;
}
