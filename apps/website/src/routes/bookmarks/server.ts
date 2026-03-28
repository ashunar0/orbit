import type { Bookmark } from "./schema"

// ── インメモリストア ──

let nextId = 4

const bookmarks: Bookmark[] = [
  {
    id: "1",
    url: "https://react.dev",
    title: "React 公式ドキュメント",
    description: "React 19 の公式リファレンス",
    tags: ["react", "docs"],
    createdAt: "2026-03-01",
  },
  {
    id: "2",
    url: "https://vitejs.dev",
    title: "Vite",
    description: "次世代フロントエンドビルドツール",
    tags: ["vite", "tooling"],
    createdAt: "2026-03-10",
  },
  {
    id: "3",
    url: "https://zod.dev",
    title: "Zod",
    description: "TypeScript-first スキーマバリデーション",
    tags: ["zod", "validation", "tooling"],
    createdAt: "2026-03-15",
  },
]

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ── Queries ──

export async function getBookmarks(signal?: AbortSignal): Promise<Bookmark[]> {
  await delay(300)
  signal?.throwIfAborted()
  return [...bookmarks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getBookmark(id: string, signal?: AbortSignal): Promise<Bookmark | null> {
  await delay(200)
  signal?.throwIfAborted()
  return bookmarks.find((b) => b.id === id) ?? null
}

export async function getAllTags(signal?: AbortSignal): Promise<string[]> {
  await delay(100)
  signal?.throwIfAborted()
  const tagSet = new Set(bookmarks.flatMap((b) => b.tags))
  return [...tagSet].sort()
}

// ── Mutations ──

export async function createBookmark(data: {
  url: string
  title: string
  description: string
  tags: string[]
}): Promise<Bookmark> {
  await delay(300)
  const bookmark: Bookmark = {
    id: String(nextId++),
    ...data,
    createdAt: new Date().toISOString().slice(0, 10),
  }
  bookmarks.push(bookmark)
  return bookmark
}

export async function updateBookmark(
  id: string,
  data: { url: string; title: string; description: string; tags: string[] },
): Promise<Bookmark> {
  await delay(300)
  const bookmark = bookmarks.find((b) => b.id === id)
  if (!bookmark) throw new Error("Bookmark not found")
  Object.assign(bookmark, data)
  return { ...bookmark }
}

export async function deleteBookmark(id: string): Promise<void> {
  await delay(200)
  const idx = bookmarks.findIndex((b) => b.id === id)
  if (idx !== -1) bookmarks.splice(idx, 1)
}
