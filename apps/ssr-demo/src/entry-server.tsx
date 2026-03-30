import { renderToString } from "react-dom/server";
import { createQueryClient } from "orbit-query";
import { App } from "./app";
import "./app.css";

export function render(url: string) {
  const queryClient = createQueryClient();

  const html = renderToString(<App queryClient={queryClient} url={url} />);

  const dehydratedState = queryClient.dehydrate();

  return { html, dehydratedState };
}
