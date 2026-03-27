import { Link, useParams } from "orbit-router"
import { useQuery, useMutation } from "orbit-query"
import { useForm, useField, Form, Field } from "orbit-form"
import { postQuery } from "../../queries"
import { updatePost } from "../../api"
import { postSchema } from "../../schema"

export default function PostEdit() {
  const { id } = useParams<"/posts/:id">()

  // orbit-query でデータ取得
  const { data: post, isLoading, error } = useQuery(postQuery(id))

  // mutation
  const { mutate } = useMutation({
    fn: (data: { title: string; body: string }) => updatePost(id, data),
    invalidate: ["posts"],
  })

  // orbit-form — 非同期 defaultValues
  // post が undefined の間は store: null → <Form> は null を返す
  const form = useForm({
    schema: postSchema,
    defaultValues: post ?? undefined,
  })

  const handleSubmit = async (data: { title: string; body: string }) => {
    await mutate(data)
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
            <TitleField form={form} />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label>
            Body
            <br />
            <BodyField form={form} />
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

function TitleField({ form }: { form: ReturnType<typeof useForm> }) {
  if (!form.store) return null
  const field = useField(form.store, "title")
  return (
    <>
      <input {...field.props} style={{ width: "100%", padding: 4 }} />
      {field.touched && field.error && (
        <span style={{ color: "red", fontSize: "0.8em" }}>{field.error}</span>
      )}
    </>
  )
}

function BodyField({ form }: { form: ReturnType<typeof useForm> }) {
  if (!form.store) return null
  const field = useField(form.store, "body")
  return (
    <textarea
      value={field.value as string}
      onChange={(e) => field.setValue(e.target.value)}
      onBlur={field.setTouched}
      style={{ width: "100%", minHeight: 100, padding: 4 }}
    />
  )
}
