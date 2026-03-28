import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { useRouterDispatchContext } from "./router";
import type { ValidHref } from "../types";

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: ValidHref;
}

export function Link({ href, children, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouterDispatchContext();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // 修飾キーや右クリック時はブラウザのデフォルト動作を維持
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onClick?.(e);
    navigate(href);
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
