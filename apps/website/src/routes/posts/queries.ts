import { fetchPosts, fetchPost } from "./api"

export const postsQuery = () => ({
  key: ["posts"] as const,
  fn: ({ signal }: { signal: AbortSignal }) => fetchPosts(signal),
})

export const postQuery = (id: string) => ({
  key: ["posts", id] as const,
  fn: ({ signal }: { signal: AbortSignal }) => fetchPost(id, signal),
})
