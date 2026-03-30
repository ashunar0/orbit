import { z } from "zod";

// ── Bookmark スキーマ（single source of truth） ──

export const bookmarkSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
});

export type Bookmark = z.infer<typeof bookmarkSchema>;

// ── server.ts 入力スキーマ（RPC バリデーション対象） ──

export const bookmarkInputSchema = bookmarkSchema.omit({ id: true, createdAt: true });

export type BookmarkInput = z.infer<typeof bookmarkInputSchema>;

// ── フォームスキーマ（クライアント側バリデーション） ──

export const bookmarkFormSchema = z.object({
  url: z.string().url("有効な URL を入力してください"),
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string(),
  tags: z.string(), // カンマ区切り → hooks.ts で配列に変換してから server.ts へ
});

export type BookmarkForm = z.infer<typeof bookmarkFormSchema>;

// ── searchParams スキーマ ──

export function parseSearchParams(raw: Record<string, string>) {
  return {
    q: raw.q ?? "",
    tag: raw.tag ?? "",
  };
}

export type BookmarkSearchParams = ReturnType<typeof parseSearchParams>;
