import { useState } from "react";
import { Link } from "orbit-router";
import type { z } from "zod";
import { useForm, useField, type UseFormReturn } from "orbit-form";
import { orderSchema, defaultOrderValues, type OrderInput } from "./schema";

export default function FormDemo() {
  const [submittedData, setSubmittedData] = useState<string | null>(null);

  const form = useForm({
    schema: orderSchema,
    defaultValues: defaultOrderValues,
    dependencies: {
      // 配送方法が変わったら住所をリセット
      deliveryMethod: (value, form) => {
        if (value === "pickup") form.setValue("address", "");
      },
      // 割引タイプが変わったら割引値をリセット
      discountType: (value, form) => {
        if (value === "none") form.setValue("discountValue", 0);
      },
    },
  });

  const handleSubmit = (data: unknown) => {
    setSubmittedData(JSON.stringify(data, null, 2));
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h1>orbit-form Demo</h1>
      <p style={{ color: "#888" }}>
        dependencies / Zod refine / Zod transform の動作確認
      </p>

      <form onSubmit={form.submit(handleSubmit)}>
        <fieldset style={{ marginBottom: 16 }}>
          <legend>基本情報</legend>
          <FormField form={form} name="customerName" label="顧客名" />
          <FormField form={form} name="email" label="メール" />
        </fieldset>

        <fieldset style={{ marginBottom: 16 }}>
          <legend>配送 (dependencies デモ)</legend>
          <DeliveryMethodField form={form} />
          <AddressField form={form} />
        </fieldset>

        <fieldset style={{ marginBottom: 16 }}>
          <legend>割引 (dependencies + refine デモ)</legend>
          <DiscountTypeField form={form} />
          <DiscountValueField form={form} />
        </fieldset>

        <fieldset style={{ marginBottom: 16 }}>
          <legend>タグ (Zod transform デモ)</legend>
          <FormField form={form} name="tags" label="タグ（カンマ区切り）" />
          <p style={{ color: "#888", fontSize: "0.8em", margin: "4px 0 0" }}>
            例: react, zod, orbit → submit 時に配列 ["react", "zod", "orbit"]
            に変換
          </p>
        </fieldset>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="submit">Submit</button>
          <button type="button" onClick={() => form.reset()}>
            Reset
          </button>
          {form.isDirty && <span style={{ color: "#c80" }}>変更あり</span>}
        </div>

        {form.errors._root && (
          <p style={{ color: "red" }}>{form.errors._root}</p>
        )}
      </form>

      {submittedData && (
        <div style={{ marginTop: 24 }}>
          <h2>Submit 結果（Zod transform 適用後）</h2>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
            {submittedData}
          </pre>
        </div>
      )}

      <p style={{ marginTop: 16 }}>
        <Link href="/">← Home</Link>
      </p>
    </div>
  );
}

// --- フィールドコンポーネント ---

type FormType = UseFormReturn<OrderInput, z.output<typeof orderSchema>>;

function FormField({
  form,
  name,
  label,
}: {
  form: FormType;
  name: keyof OrderInput & string;
  label: string;
}) {
  if (!form.store) return null;
  const field = useField(form.store, name);
  return (
    <div style={{ marginBottom: 8 }}>
      <label>
        {label}
        <br />
        <input {...field.props} value={String(field.props.value ?? "")} style={{ width: "100%", padding: 4 }} />
      </label>
      {field.touched && field.error && (
        <span style={{ color: "red", fontSize: "0.8em" }}>{field.error}</span>
      )}
    </div>
  );
}

function DeliveryMethodField({ form }: { form: FormType }) {
  if (!form.store) return null;
  const field = useField(form.store, "deliveryMethod");
  return (
    <div style={{ marginBottom: 8 }}>
      <label>
        配送方法
        <br />
        <select
          value={field.value as string}
          onChange={(e) =>
            field.setValue(e.target.value as "shipping" | "pickup")
          }
          onBlur={field.setTouched}
        >
          <option value="shipping">配送</option>
          <option value="pickup">店舗受取</option>
        </select>
      </label>
    </div>
  );
}

function AddressField({ form }: { form: FormType }) {
  if (!form.store) return null;
  const field = useField(form.store, "address");
  const deliveryMethod = useField(form.store, "deliveryMethod");

  const isRequired = deliveryMethod.value === "shipping";

  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ opacity: isRequired ? 1 : 0.5 }}>
        住所 {isRequired ? "(必須)" : "(不要)"}
        <br />
        <input
          {...field.props}
          value={String(field.props.value ?? "")}
          disabled={!isRequired}
          style={{ width: "100%", padding: 4 }}
        />
      </label>
      {field.touched && field.error && (
        <span style={{ color: "red", fontSize: "0.8em" }}>{field.error}</span>
      )}
    </div>
  );
}

function DiscountTypeField({ form }: { form: FormType }) {
  if (!form.store) return null;
  const field = useField(form.store, "discountType");
  return (
    <div style={{ marginBottom: 8 }}>
      <label>
        割引タイプ
        <br />
        <select
          value={field.value as string}
          onChange={(e) =>
            field.setValue(e.target.value as "none" | "percent" | "fixed")
          }
          onBlur={field.setTouched}
        >
          <option value="none">なし</option>
          <option value="percent">%割引</option>
          <option value="fixed">固定額</option>
        </select>
      </label>
    </div>
  );
}

function DiscountValueField({ form }: { form: FormType }) {
  if (!form.store) return null;
  const field = useField(form.store, "discountValue");
  const discountType = useField(form.store, "discountType");

  const isDisabled = discountType.value === "none";
  const unit = discountType.value === "percent" ? "%" : "円";

  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ opacity: isDisabled ? 0.5 : 1 }}>
        割引値 {!isDisabled && `(${unit})`}
        <br />
        <input
          type="number"
          value={field.value as number}
          onChange={(e) => field.setValue(Number(e.target.value))}
          onBlur={field.setTouched}
          disabled={isDisabled}
          style={{ width: 120, padding: 4 }}
        />
      </label>
      {field.touched && field.error && (
        <span style={{ color: "red", fontSize: "0.8em" }}>{field.error}</span>
      )}
    </div>
  );
}
