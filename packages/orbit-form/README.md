# Orbit Form

React Compiler compatible form library with Zod validation — designed for the AI era.

> Part of the [Orbit](../../) frontend toolkit — designed so that AI-generated code and human-written code always look the same.

## Features

- **React Compiler compatible** — `useSyncExternalStore` based, no Proxy, no class instances
- **Zod validation** — Schema-driven validation with type inference
- **`form.register()`** — Bind fields to inputs with a single call
- **Async default values** — Handles loading state when defaults come from API
- **Field dependencies** — React to field changes (e.g., reset address when delivery method changes)
- **`<Form>` component** — Handles submission with built-in null-store guard

## Quick Start

```bash
pnpm add orbit-form zod
```

```tsx
import { useForm, Form } from "orbit-form";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

export default function MyForm() {
  const form = useForm({
    schema,
    defaultValues: { name: "", email: "" },
  });

  const handleSubmit = async (data: z.output<typeof schema>) => {
    await saveUser(data);
  };

  return (
    <Form form={form} onSubmit={handleSubmit}>
      <input {...form.register("name")} />
      {form.fieldError("name") && <p>{form.fieldError("name")}</p>}

      <input {...form.register("email")} />
      {form.fieldError("email") && <p>{form.fieldError("email")}</p>}

      <button type="submit" disabled={form.isSubmitting}>
        {form.isSubmitting ? "Saving..." : "Save"}
      </button>
    </Form>
  );
}
```

## useForm

```ts
const form = useForm({ schema, defaultValues, dependencies });
```

| Option          | Type                       | Description                                            |
| --------------- | -------------------------- | ------------------------------------------------------ |
| `schema`        | `ZodType`                  | **Required.** Zod schema for validation                |
| `defaultValues` | `T \| undefined`           | Initial values. `undefined` enables async loading mode |
| `dependencies`  | `Record<string, Function>` | Field change callbacks (e.g., reset dependent fields)  |

### Return value

| Property           | Type                          | Description                                   |
| ------------------ | ----------------------------- | --------------------------------------------- |
| `register(name)`   | `{ value, onChange, onBlur }` | Bind a field to an input element              |
| `fieldError(name)` | `string \| undefined`         | Get validation error for a field              |
| `values`           | `T`                           | Current form values                           |
| `errors`           | `Record<string, string>`      | All validation errors                         |
| `isDirty`          | `boolean`                     | Whether any field has changed                 |
| `isSubmitting`     | `boolean`                     | Whether form is being submitted               |
| `submit(onSubmit)` | `(e?) => void`                | Create a submit handler                       |
| `reset(name?)`     | `void`                        | Reset all fields or a specific field          |
| `store`            | `FormStore \| null`           | `null` while async default values are loading |

## Field Dependencies

React to field value changes to update other fields:

```ts
const form = useForm({
  schema: orderSchema,
  defaultValues,
  dependencies: {
    deliveryMethod: (value, form) => {
      if (value === "pickup") form.setValue("address", "");
    },
  },
});
```

## Async Default Values

When editing existing data, pass `undefined` initially and the actual values once loaded:

```ts
const { data: user } = useUser(id);

const form = useForm({
  schema: userSchema,
  defaultValues: user ?? undefined, // null → undefined while loading
});
```

The `<Form>` component renders nothing while `form.store` is `null`, preventing flickers.

## Recommended Pattern

Define form hooks in `hooks.ts`:

```ts
// routes/users/hooks.ts
import { useForm } from "orbit-form";
import { userSchema, type UserInput } from "./schema";

const defaults: UserInput = { name: "", email: "" };

export function useCreateUserForm() {
  return useForm({ schema: userSchema, defaultValues: defaults });
}

export function useEditUserForm(defaultValues: UserInput | undefined) {
  return useForm({ schema: userSchema, defaultValues });
}
```

## License

MIT
