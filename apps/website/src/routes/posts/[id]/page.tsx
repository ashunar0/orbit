import { Link, useParams } from "orbit-router"
import { usePost } from "../hooks"

export default function PostDetail() {
  const { id } = useParams<"/posts/:id">()
  const { data: post, isLoading, error } = usePost(id)

  if (isLoading) return <p>Loading...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!post) return <p>Post not found</p>

  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      <p>
        <Link href={`/posts/${id}/edit`}>Edit</Link>
        {" | "}
        <Link href="/posts">← Back to posts</Link>
      </p>
    </div>
  )
}
