import { Link } from "orbit-router"
import { useQuery, useMutation } from "orbit-query"
import { useForm, useField, Form, Field } from "orbit-form"
import { createPost } from "./api"
import { postsQuery } from "./queries"
import { postSchema, type PostInput } from "./schema"

const defaultValues: PostInput = { title: "", body: "" }

export default function Posts() {
  const { data: posts, isLoading, error, refetch } = useQuery(postsQuery())

  const { mutate } = useMutation({
    fn: ({ title, body }: { title: string; body: string }) => createPost(title, body),
    invalidate: ["posts"],
  })

  const form = useForm({
    schema: postSchema,
    defaultValues,
  })

  const handleSubmit = async (data: { title: string; body: string }) => {
    await mutate(data)
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
          <Field<PostInput, { title: string; body: string }, "title"> name="title">
            {(field) => (
              <>
                <input placeholder="Title" {...field.props} />
                {field.touched && field.error && (
                  <span style={{ color: "red", fontSize: "0.8em" }}>{field.error}</span>
                )}
              </>
            )}
          </Field>
        </div>
        <div>
          <Field<PostInput, { title: string; body: string }, "body"> name="body">
            {(field) => (
              <textarea
                placeholder="Body"
                value={field.value}
                onChange={(e) => field.setValue(e.target.value)}
                onBlur={field.setTouched}
              />
            )}
          </Field>
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
