import type { FormEvent, FormHTMLAttributes } from "react";
import { useRouterDispatchContext } from "./router";

interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  /** true にすると FormData の代わりに JSON オブジェクトとして action に渡す */
  json?: boolean;
}

export function Form({ children, json, ...rest }: FormProps) {
  const { submitAction } = useRouterDispatchContext();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (json) {
      const data: Record<string, unknown> = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });
      await submitAction(data);
    } else {
      await submitAction(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} {...rest}>
      {children}
    </form>
  );
}
