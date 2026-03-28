import { useSearchParams } from "orbit-router"
import { useQuery, useMutation } from "orbit-query"
import { useForm } from "orbit-form"
import {
  getBookmarks,
  getBookmark,
  getAllTags,
  createBookmark,
  updateBookmark,
  deleteBookmark,
} from "./server"
import { bookmarkSchema, parseSearchParams, type BookmarkInput } from "./schema"

// ── Search Params ──

export function useBookmarkSearch() {
  return useSearchParams(parseSearchParams)
}

// ── Queries ──

export function useBookmarks() {
  return useQuery({
    key: ["bookmarks"] as const,
    fn: ({ signal }: { signal: AbortSignal }) => getBookmarks(signal),
  })
}

export function useBookmark(id: string) {
  return useQuery({
    key: ["bookmarks", id] as const,
    fn: ({ signal }: { signal: AbortSignal }) => getBookmark(id, signal),
  })
}

export function useTags() {
  return useQuery({
    key: ["tags"] as const,
    fn: ({ signal }: { signal: AbortSignal }) => getAllTags(signal),
  })
}

// ── Mutations ──

export function useCreateBookmark() {
  return useMutation({
    fn: (input: BookmarkInput) =>
      createBookmark({
        ...input,
        tags: input.tags ? input.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      }),
    invalidate: ["bookmarks", "tags"],
  })
}

export function useUpdateBookmark(id: string) {
  return useMutation({
    fn: (input: BookmarkInput) =>
      updateBookmark(id, {
        ...input,
        tags: input.tags ? input.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      }),
    invalidate: ["bookmarks", "tags"],
  })
}

export function useDeleteBookmark() {
  return useMutation({
    fn: (id: string) => deleteBookmark(id),
    invalidate: ["bookmarks", "tags"],
  })
}

// ── Forms ──

const createDefaults: BookmarkInput = { url: "", title: "", description: "", tags: "" }

export function useCreateBookmarkForm() {
  return useForm({ schema: bookmarkSchema, defaultValues: createDefaults })
}

export function useEditBookmarkForm(defaultValues: BookmarkInput | undefined) {
  return useForm({ schema: bookmarkSchema, defaultValues })
}

// ── Filtering (pure transform) ──

export function filterBookmarks(
  bookmarks: { id: string; url: string; title: string; tags: string[] }[],
  q: string,
  tag: string,
) {
  let result = bookmarks
  if (q) {
    const lower = q.toLowerCase()
    result = result.filter((b) => b.title.toLowerCase().includes(lower) || b.url.toLowerCase().includes(lower))
  }
  if (tag) {
    result = result.filter((b) => b.tags.includes(tag))
  }
  return result
}
