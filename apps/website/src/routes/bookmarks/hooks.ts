import { useSearchParams } from "orbit-router";
import { useQuery, useMutation } from "orbit-query";
import { useForm } from "orbit-form";
import {
  getBookmarks,
  getBookmark,
  getAllTags,
  createBookmark,
  updateBookmark,
  deleteBookmark,
} from "./server";
import {
  bookmarkFormSchema,
  parseSearchParams,
  type Bookmark,
  type BookmarkForm,
} from "./schema";

// ── Search Params ──

export function useBookmarkSearch() {
  return useSearchParams(parseSearchParams);
}

// ── Queries ──

export function useBookmarks() {
  return useQuery({
    key: ["bookmarks"] as const,
    fn: ({ signal }: { signal: AbortSignal }) => getBookmarks(signal),
  });
}

export function useBookmark(id: string) {
  return useQuery({
    key: ["bookmarks", id] as const,
    fn: ({ signal }: { signal: AbortSignal }) => getBookmark(id, signal),
  });
}

export function useTags() {
  return useQuery({
    key: ["tags"] as const,
    fn: ({ signal }: { signal: AbortSignal }) => getAllTags(signal),
  });
}

// ── Mutations ──

export function useCreateBookmark() {
  return useMutation({
    fn: (input: BookmarkForm) =>
      createBookmark({
        ...input,
        tags: input.tags
          ? input.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      }),
    invalidate: ["bookmarks", "tags"],
  });
}

export function useUpdateBookmark(id: string) {
  return useMutation({
    fn: (input: BookmarkForm) =>
      updateBookmark(id, {
        ...input,
        tags: input.tags
          ? input.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      }),
    invalidate: ["bookmarks", "tags"],
  });
}

export function useDeleteBookmark() {
  return useMutation({
    fn: (id: string) => deleteBookmark(id),
    invalidate: ["bookmarks", "tags"],
  });
}

// ── Forms ──

const createDefaults: BookmarkForm = { url: "", title: "", description: "", tags: "" };

export function useCreateBookmarkForm() {
  return useForm({ schema: bookmarkFormSchema, defaultValues: createDefaults });
}

export function useEditBookmarkForm(defaultValues: BookmarkForm | undefined) {
  return useForm({ schema: bookmarkFormSchema, defaultValues });
}

// ── Filtering (pure transform) ──

export function filterBookmarks(
  bookmarks: Bookmark[],
  q: string,
  tag: string,
) {
  let result = bookmarks;
  if (q) {
    const lower = q.toLowerCase();
    result = result.filter(
      (b) => b.title.toLowerCase().includes(lower) || b.url.toLowerCase().includes(lower),
    );
  }
  if (tag) {
    result = result.filter((b) => b.tags.includes(tag));
  }
  return result;
}
