import { Link, useParams } from "orbit-router"
import { Form } from "orbit-form"
import { usePost, useUpdatePost, useEditPostForm } from "../../hooks"

export default function PostEdit() {
  const { id } = useParams<"/posts/:id">()
  const { data: post, isLoading, error } = usePost(id)
  const { mutate: update } = useUpdatePost(id)
  const form = useEditPostForm(post ?? undefined)

  const handleSubmit = async (data: { title: string; body: string }) => {
    await update(data)
    alert("Updated!")
  }

  if (isLoading) return <p>Loading...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!post) return <p>Post not found</p>

  return (
    <div>
      <h1>Edit Post</h1>

      <Form form={form} onSubmit={handleSubmit}>
        <div style={{ marginBottom: 8 }}>
          <label>
            Title
            <br />
            <input {...form.register("title")} style={{ width: "100%", padding: 4 }} />
            {form.fieldError("title") && (
              <span style={{ color: "red", fontSize: "0.8em" }}>{form.fieldError("title")}</span>
            )}
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Body
            <br />
            <textarea {...form.register("body")} style={{ width: "100%", minHeight: 100, padding: 4 }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="submit" disabled={form.isSubmitting || !form.isDirty}>
            {form.isSubmitting ? "Saving..." : "Save"}
          </button>
          {form.isDirty && <span style={{ color: "#888", fontSize: "0.85em" }}>未保存の変更があります</span>}
        </div>
      </Form>

      <p style={{ marginTop: 16 }}>
        <Link href={`/posts/${id}`}>← Back to post</Link>
      </p>
    </div>
  )
}
