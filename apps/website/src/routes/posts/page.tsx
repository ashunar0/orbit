import { useState } from "react"
import { Link } from "orbit-router"
import { useQuery, useMutation } from "orbit-query"
import { createPost } from "./api"
import { postsQuery } from "./queries"

export default function Posts() {
  const { data: posts, isLoading, error, refetch } = useQuery(postsQuery())

  const { mutate, isSubmitting } = useMutation({
    fn: ({ title, body }: { title: string; body: string }) => createPost(title, body),
    invalidate: ["posts"],
  })

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await mutate({ title, body })
    setTitle("")
    setBody("")
  }

  if (isLoading) return <p>Loading posts...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>

  return (
    <div>
      <h1>Posts ({posts?.length ?? 0})</h1>

      <ul>
        {posts?.map((post) => (
          <li key={post.id}>
            <Link href={`/posts/${post.id}`}>{post.title}</Link>
          </li>
        ))}
      </ul>

      <h2>New Post</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <textarea
            placeholder="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Posting..." : "Create Post"}
        </button>
      </form>

      <p>
        <button onClick={refetch}>Refetch</button>
      </p>
      <p>
        <Link href="/">← Home</Link>
      </p>
    </div>
  )
}
