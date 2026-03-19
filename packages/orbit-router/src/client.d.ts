declare module "virtual:orbit-router/routes" {
  import type { ComponentType } from "react";

  interface Route {
    path: string;
    component: ComponentType;
    layouts: ComponentType<{ children: React.ReactNode }>[];
  }

  export const routes: Route[];
}
