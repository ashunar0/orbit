// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { z } from "zod";
import { useForm } from "../use-form";
import { useField } from "../use-field";
import { createFormStore } from "../store";
import type { FormStore } from "../types";

afterEach(cleanup);

const userSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  email: z.string().email("メールアドレスの形式が不正です"),
});

type UserInput = z.input<typeof userSchema>;
type UserOutput = z.output<typeof userSchema>;

const defaults: UserInput = { name: "", email: "" };

describe("useForm", () => {
  it("provides form state", () => {
    function TestForm() {
      const form = useForm({ schema: userSchema, defaultValues: defaults });

      return (
        <div>
          <span data-testid="dirty">{String(form.isDirty)}</span>
          <span data-testid="submitting">{String(form.isSubmitting)}</span>
        </div>
      );
    }

    render(<TestForm />);

    expect(screen.getByTestId("dirty").textContent).toBe("false");
    expect(screen.getByTestId("submitting").textContent).toBe("false");
  });

  it("submit validates and calls onSubmit with transformed data", async () => {
    const onSubmit = vi.fn();

    function TestForm() {
      const form = useForm({ schema: userSchema, defaultValues: defaults });

      return (
        <div>
          <button
            data-testid="fill-and-submit"
            onClick={() => {
              form.store?.setValue("name", "あさひ");
              form.store?.setValue("email", "asahi@example.com");
              form.submit(onSubmit)();
            }}
          >
            Submit
          </button>
        </div>
      );
    }

    render(<TestForm />);

    await act(async () => {
      screen.getByTestId("fill-and-submit").click();
    });

    expect(onSubmit).toHaveBeenCalledWith({ name: "あさひ", email: "asahi@example.com" });
  });

  it("submit shows errors when validation fails", async () => {
    const onSubmit = vi.fn();

    function TestForm() {
      const form = useForm({ schema: userSchema, defaultValues: defaults });

      return (
        <div>
          <button data-testid="submit" onClick={form.submit(onSubmit)}>
            Submit
          </button>
          <span data-testid="name-error">{form.errors.name ?? "none"}</span>
          <span data-testid="email-error">{form.errors.email ?? "none"}</span>
        </div>
      );
    }

    render(<TestForm />);

    await act(async () => {
      screen.getByTestId("submit").click();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("name-error").textContent).toBe("名前は必須です");
      expect(screen.getByTestId("email-error").textContent).toBe("メールアドレスの形式が不正です");
    });
  });

  it("handles async defaultValues (undefined → data)", async () => {
    function TestForm({ data }: { data: UserInput | undefined }) {
      const form = useForm({ schema: userSchema, defaultValues: data });

      return (
        <div>
          <span data-testid="name">{form.values.name ?? "loading"}</span>
        </div>
      );
    }

    const { rerender } = render(<TestForm data={undefined} />);

    // undefined の間は空
    expect(screen.getByTestId("name").textContent).toBe("loading");

    // データ到着
    rerender(<TestForm data={{ name: "あさひ", email: "asahi@example.com" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("name").textContent).toBe("あさひ");
    });
  });
});

describe("useField", () => {
  function FieldTest({ store }: { store: FormStore<UserInput, UserOutput> }) {
    const field = useField(store, "name");

    return (
      <div>
        <input data-testid="input" {...field.props} />
        <span data-testid="error">{field.error ?? "none"}</span>
        <span data-testid="touched">{String(field.touched)}</span>
      </div>
    );
  }

  function FormWithField() {
    const form = useForm({ schema: userSchema, defaultValues: defaults });
    if (!form.store) return null;

    return <FieldTest store={form.store} />;
  }

  it("renders field value from store", () => {
    render(<FormWithField />);

    const input = screen.getByTestId("input") as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("shows error after setValue + setTouched (blur equivalent)", async () => {
    function DirectFieldTest() {
      const form = useForm({ schema: userSchema, defaultValues: defaults });
      if (!form.store) return null;

      const field = useField(form.store, "name");

      return (
        <div>
          <span data-testid="field-error">{field.error ?? "none"}</span>
          <span data-testid="field-touched">{String(field.touched)}</span>
          <button
            data-testid="touch-name"
            onClick={() => {
              field.setTouched();
            }}
          >
            Touch
          </button>
        </div>
      );
    }

    render(<DirectFieldTest />);

    // blur 相当（setTouched + validateField）
    await act(async () => {
      screen.getByTestId("touch-name").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("field-touched").textContent).toBe("true");
      expect(screen.getByTestId("field-error").textContent).toBe("名前は必須です");
    });
  });

  it("isolates re-renders to only the subscribed field", () => {
    const store = createFormStore({ schema: userSchema, defaultValues: defaults });
    let nameRenderCount = 0;
    let emailRenderCount = 0;

    function NameField() {
      const field = useField(store, "name");
      nameRenderCount++;
      return <input data-testid="name-isolated" value={field.value} readOnly />;
    }

    function EmailField() {
      const field = useField(store, "email");
      emailRenderCount++;
      return <input data-testid="email-isolated" value={field.value} readOnly />;
    }

    render(
      <div>
        <NameField />
        <EmailField />
      </div>,
    );

    const initialNameCount = nameRenderCount;
    const initialEmailCount = emailRenderCount;

    act(() => {
      store.setValue("name", "あさひ");
    });

    // name は再レンダリングされる
    expect(nameRenderCount).toBeGreaterThan(initialNameCount);
    // email は再レンダリングされない
    expect(emailRenderCount).toBe(initialEmailCount);
  });
});
