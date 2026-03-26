import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { useRouterDispatchContext } from "./router";
import type { ValidHref } from "../types";

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: ValidHref;
  /** false を渡すと hover 時の prefetch を無効化する */
  prefetch?: boolean;
}

export function Link({ href, children, onClick, prefetch: shouldPrefetch = true, ...rest }: LinkProps) {
  const { navigate, prefetch } = useRouterDispatchContext();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // 修飾キーや右クリック時はブラウザのデフォルト動作を維持
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    e.preventDefault();
    onClick?.(e);
    navigate(href);
  };

  const handleMouseEnter = () => {
    if (shouldPrefetch) prefetch(href);
  };

  return (
    <a href={href} onClick={handleClick} onMouseEnter={handleMouseEnter} {...rest}>
      {children}
    </a>
  );
}
