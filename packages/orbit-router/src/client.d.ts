declare module "virtual:orbit-router/routes" {
  import type { ComponentType, LazyExoticComponent } from "react";
  import type { LoaderArgs, ActionArgs } from "orbit-router";

  interface LayoutEntry {
    component: ComponentType<{ children: React.ReactNode }>;
    loader?: (args: LoaderArgs) => Promise<unknown>;
  }

  interface Route {
    path: string;
    component: ComponentType | LazyExoticComponent<ComponentType>;
    layouts: LayoutEntry[];
    loader?: (args: LoaderArgs) => Promise<unknown>;
    action?: (args: ActionArgs) => Promise<unknown>;
    Loading?: ComponentType;
    ErrorBoundary?: ComponentType<{ error: Error }>;
  }

  export const routes: Route[];
  export const NotFound: ComponentType | undefined;
}
