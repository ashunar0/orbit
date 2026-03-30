import { hydrateRoot } from "react-dom/client";
import { createQueryClient } from "orbit-query";
import { App } from "./app";
import "./app.css";

const queryClient = createQueryClient();

// サーバーから送られた dehydrated state を復元
const dehydratedState = (window as any).__ORBIT_DATA__;
if (dehydratedState) {
  queryClient.hydrate(dehydratedState);
}

hydrateRoot(document.getElementById("root")!, <App queryClient={queryClient} />);
