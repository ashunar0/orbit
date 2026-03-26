import { Link, useParams } from "orbit-router"
import { useQuery } from "orbit-query"
import { postQuery } from "../queries"

export default function PostDetail() {
  const { id } = useParams()
  const { data: post, isLoading, error } = useQuery(postQuery(id))

  if (isLoading) return <p>Loading...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!post) return <p>Post not found</p>

  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      <Link href="/posts">← Back to posts</Link>
    </div>
  )
}
