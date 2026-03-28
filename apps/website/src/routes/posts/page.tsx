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

  if (isLoading) return <p className="text-gray-500">Loading posts...</p>
  if (error) return <p className="text-red-600">Error: {error.message}</p>

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Posts ({posts?.length ?? 0})</h1>

      <ul className="space-y-1 mb-6">
        {posts?.map((post) => (
          <li key={post.id}>
            <Link href={`/posts/${post.id}`} className="text-blue-600 hover:underline">{post.title}</Link>
          </li>
        ))}
      </ul>

      <h2 className="text-lg font-semibold mb-2">New Post</h2>
      <Form form={form} onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input placeholder="Title" {...form.register("title")} className="w-full border rounded px-3 py-1.5 text-sm" />
          {form.fieldError("title") && (
            <p className="text-red-500 text-xs mt-1">{form.fieldError("title")}</p>
          )}
        </div>
        <div>
          <textarea placeholder="Body" {...form.register("body")} className="w-full border rounded px-3 py-1.5 text-sm" />
        </div>
        <button type="submit" disabled={form.isSubmitting} className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {form.isSubmitting ? "Posting..." : "Create Post"}
        </button>
      </Form>

      <div className="mt-6 flex gap-3 text-sm">
        <button onClick={refetch} className="text-gray-500 hover:text-gray-700 cursor-pointer">Refetch</button>
        <Link href="/" className="text-gray-500 hover:underline">&larr; Home</Link>
      </div>
    </div>
  )
}
