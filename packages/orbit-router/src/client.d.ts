declare module "virtual:orbit-router/routes" {
  import type { ComponentType, LazyExoticComponent } from "react";
  import type { LoaderArgs, ActionArgs } from "orbit-router";

  type LoaderFunction = (args: LoaderArgs) => Promise<unknown>;
  type GuardFunction = (args: LoaderArgs) => Promise<void>;

  interface LayoutEntry {
    component: ComponentType<{ children: React.ReactNode }>;
    loader?: LoaderFunction;
    ErrorBoundary?: ComponentType<{ error: Error }>;
  }

  interface Route {
    path: string;
    component: ComponentType | LazyExoticComponent<ComponentType>;
    layouts: LayoutEntry[];
    guards: GuardFunction[];
    loader?: LoaderFunction;
    action?: (args: ActionArgs) => Promise<unknown>;
    Loading?: ComponentType;
    ErrorBoundary?: ComponentType<{ error: Error }>;
  }

  export const routes: Route[];
  export const NotFound: ComponentType | undefined;
}
