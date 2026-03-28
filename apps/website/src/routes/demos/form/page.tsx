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
      deliveryMethod: (value, form) => {
        if (value === "pickup") form.setValue("address", "");
      },
      discountType: (value, form) => {
        if (value === "none") form.setValue("discountValue", 0);
      },
    },
  });

  const handleSubmit = (data: unknown) => {
    setSubmittedData(JSON.stringify(data, null, 2));
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">orbit-form Demo</h1>
      <p className="text-gray-400 text-sm mb-4">
        dependencies / Zod refine / Zod transform の動作確認
      </p>

      <form onSubmit={form.submit(handleSubmit)} className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="font-semibold text-sm mb-1">基本情報</legend>
          <FormField form={form} name="customerName" label="顧客名" />
          <FormField form={form} name="email" label="メール" />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold text-sm mb-1">配送 (dependencies デモ)</legend>
          <DeliveryMethodField form={form} />
          <AddressField form={form} />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold text-sm mb-1">割引 (dependencies + refine デモ)</legend>
          <DiscountTypeField form={form} />
          <DiscountValueField form={form} />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold text-sm mb-1">タグ (Zod transform デモ)</legend>
          <FormField form={form} name="tags" label="タグ（カンマ区切り）" />
          <p className="text-gray-400 text-xs">
            例: react, zod, orbit → submit 時に配列 ["react", "zod", "orbit"] に変換
          </p>
        </fieldset>

        <div className="flex items-center gap-3">
          <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Submit</button>
          <button type="button" onClick={() => form.reset()} className="border border-gray-300 px-4 py-1.5 rounded text-sm hover:bg-gray-50">Reset</button>
          {form.isDirty && <span className="text-amber-600 text-sm">変更あり</span>}
        </div>

        {form.errors._root && (
          <p className="text-red-600 text-sm">{form.errors._root}</p>
        )}
      </form>

      {submittedData && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Submit 結果（Zod transform 適用後）</h2>
          <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">{submittedData}</pre>
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href="/" className="text-gray-500 hover:underline">&larr; Home</Link>
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
    <div>
      <label className="block text-sm">
        {label}
        <input {...field.props} value={String(field.props.value ?? "")} className="mt-1 w-full border rounded px-3 py-1.5 text-sm" />
      </label>
      {field.touched && field.error && (
        <span className="text-red-500 text-xs">{field.error}</span>
      )}
    </div>
  );
}

function DeliveryMethodField({ form }: { form: FormType }) {
  if (!form.store) return null;
  const field = useField(form.store, "deliveryMethod");
  return (
    <div>
      <label className="block text-sm">
        配送方法
        <select
          value={field.value as string}
          onChange={(e) => field.setValue(e.target.value as "shipping" | "pickup")}
          onBlur={field.setTouched}
          className="mt-1 w-full border rounded px-3 py-1.5 text-sm"
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
    <div className={isRequired ? "" : "opacity-50"}>
      <label className="block text-sm">
        住所 {isRequired ? "(必須)" : "(不要)"}
        <input
          {...field.props}
          value={String(field.props.value ?? "")}
          disabled={!isRequired}
          className="mt-1 w-full border rounded px-3 py-1.5 text-sm disabled:bg-gray-100"
        />
      </label>
      {field.touched && field.error && (
        <span className="text-red-500 text-xs">{field.error}</span>
      )}
    </div>
  );
}

function DiscountTypeField({ form }: { form: FormType }) {
  if (!form.store) return null;
  const field = useField(form.store, "discountType");
  return (
    <div>
      <label className="block text-sm">
        割引タイプ
        <select
          value={field.value as string}
          onChange={(e) => field.setValue(e.target.value as "none" | "percent" | "fixed")}
          onBlur={field.setTouched}
          className="mt-1 w-full border rounded px-3 py-1.5 text-sm"
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
    <div className={isDisabled ? "opacity-50" : ""}>
      <label className="block text-sm">
        割引値 {!isDisabled && `(${unit})`}
        <input
          type="number"
          value={field.value as number}
          onChange={(e) => field.setValue(Number(e.target.value))}
          onBlur={field.setTouched}
          disabled={isDisabled}
          className="mt-1 w-30 border rounded px-3 py-1.5 text-sm disabled:bg-gray-100"
        />
      </label>
      {field.touched && field.error && (
        <span className="text-red-500 text-xs">{field.error}</span>
      )}
    </div>
  );
}
