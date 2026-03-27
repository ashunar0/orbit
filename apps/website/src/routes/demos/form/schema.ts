import { z } from "zod"

export const orderSchema = z
  .object({
    // 基本情報
    customerName: z.string().min(1, "顧客名は必須です"),
    email: z.string().email("メールアドレスの形式が不正です"),

    // dependencies デモ: 配送方法 → 住所の必須/不要が連動
    deliveryMethod: z.enum(["shipping", "pickup"]),
    address: z.string(),

    // dependencies デモ: 割引タイプ → 割引値のバリデーションが連動
    discountType: z.enum(["none", "percent", "fixed"]),
    discountValue: z.coerce.number().min(0),

    // Zod transform デモ: カンマ区切り → 配列
    tags: z.string().transform((v) => (v ? v.split(",").map((s) => s.trim()) : [])),
  })
  // Zod refine デモ: クロスフィールドバリデーション
  .refine(
    (data) => {
      if (data.deliveryMethod === "shipping" && !data.address) return false
      return true
    },
    { path: ["address"], message: "配送の場合は住所が必須です" },
  )
  .refine(
    (data) => {
      if (data.discountType === "percent" && data.discountValue > 100) return false
      return true
    },
    { path: ["discountValue"], message: "割引率は100%以下にしてください" },
  )

export type OrderInput = z.input<typeof orderSchema>

export const defaultOrderValues: OrderInput = {
  customerName: "",
  email: "",
  deliveryMethod: "shipping",
  address: "",
  discountType: "none",
  discountValue: 0,
  tags: "",
}
