import { useQuery, useMutation } from "orbit-query"
import { useForm } from "orbit-form"
import { fetchPosts, fetchPost, createPost, updatePost } from "./server"
import { postSchema, type PostInput } from "./schema"

// ── Queries ──

export function usePosts() {
  return useQuery({
    key: ["posts"] as const,
    fn: ({ signal }: { signal: AbortSignal }) => fetchPosts(signal),
  })
}

export function usePost(id: string) {
  return useQuery({
    key: ["posts", id] as const,
    fn: ({ signal }: { signal: AbortSignal }) => fetchPost(id, signal),
  })
}

// ── Mutations ──

export function useCreatePost() {
  return useMutation({
    fn: (data: PostInput) => createPost(data.title, data.body),
    invalidate: ["posts"],
  })
}

export function useUpdatePost(id: string) {
  return useMutation({
    fn: (data: PostInput) => updatePost(id, data),
    invalidate: ["posts"],
  })
}

// ── Forms ──

const createPostDefaults: PostInput = { title: "", body: "" }

export function useCreatePostForm() {
  return useForm({ schema: postSchema, defaultValues: createPostDefaults })
}

export function useEditPostForm(defaultValues: PostInput | undefined) {
  return useForm({ schema: postSchema, defaultValues })
}
