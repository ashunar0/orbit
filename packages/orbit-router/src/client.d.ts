declare module "virtual:orbit-router/routes" {
  import type { ComponentType, LazyExoticComponent } from "react";
  import type { GuardArgs } from "orbit-router";

  type GuardFunction = (args: GuardArgs) => Promise<void>;

  interface LayoutEntry {
    component: ComponentType<{ children: React.ReactNode }>;
    ErrorBoundary?: ComponentType<{ error: Error }>;
  }

  interface Route {
    path: string;
    component: ComponentType | LazyExoticComponent<ComponentType>;
    layouts: LayoutEntry[];
    guards: GuardFunction[];
    Loading?: ComponentType;
    ErrorBoundary?: ComponentType<{ error: Error }>;
  }

  export const routes: Route[];
  export const NotFound: ComponentType | undefined;
}
