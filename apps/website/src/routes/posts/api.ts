export interface Post {
  id: string
  title: string
  body: string
}

let nextId = 4

const posts: Post[] = [
  { id: "1", title: "Orbit Router リリース", body: "ディレクトリベースルーターをリリースしました。" },
  { id: "2", title: "React Compiler 互換の設計", body: "useSyncExternalStore ベースでキャッシュ同期する方針に決定。" },
  { id: "3", title: "orbit-query の実装開始", body: "SWR の書き心地 + TanStack Query の配列キーを目指します。" },
]

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function fetchPosts(signal?: AbortSignal): Promise<Post[]> {
  await delay(400)
  signal?.throwIfAborted()
  return [...posts]
}

export async function fetchPost(id: string, signal?: AbortSignal): Promise<Post | null> {
  await delay(300)
  signal?.throwIfAborted()
  return posts.find((p) => p.id === id) ?? null
}

export async function createPost(title: string, body: string): Promise<Post> {
  await delay(300)
  const post: Post = { id: String(nextId++), title, body }
  posts.push(post)
  return post
}
