import { z } from "zod"

// ── Bookmark 型 ──

export interface Bookmark {
  id: string
  url: string
  title: string
  description: string
  tags: string[]
  createdAt: string
}

// ── フォームスキーマ ──

export const bookmarkSchema = z.object({
  url: z.string().url("有効な URL を入力してください"),
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string(),
  tags: z.string(), // カンマ区切り → server.ts で配列に変換
})

export type BookmarkInput = z.input<typeof bookmarkSchema>

// ── searchParams スキーマ ──

export function parseSearchParams(raw: Record<string, string>) {
  return {
    q: raw.q ?? "",
    tag: raw.tag ?? "",
  }
}

export type BookmarkSearchParams = ReturnType<typeof parseSearchParams>
