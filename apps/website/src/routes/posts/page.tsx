import { Link } from "orbit-router"
import { Form } from "orbit-form"
import { usePosts, useCreatePost, useCreatePostForm } from "./hooks"

export default function Posts() {
  const { data: posts, isLoading, error, refetch } = usePosts()
  const form = useCreatePostForm()
  const { mutate: create } = useCreatePost()

  const handleSubmit = async (data: { title: string; body: string }) => {
    await create(data)
    form.reset()
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
      <Form form={form} onSubmit={handleSubmit}>
        <div>
          <input placeholder="Title" {...form.register("title")} />
          {form.fieldError("title") && (
            <span style={{ color: "red", fontSize: "0.8em" }}>{form.fieldError("title")}</span>
          )}
        </div>
        <div>
          <textarea placeholder="Body" {...form.register("body")} />
        </div>
        <button type="submit" disabled={form.isSubmitting}>
          {form.isSubmitting ? "Posting..." : "Create Post"}
        </button>
      </Form>

      <p>
        <button onClick={refetch}>Refetch</button>
      </p>
      <p>
        <Link href="/">← Home</Link>
      </p>
    </div>
  )
}
