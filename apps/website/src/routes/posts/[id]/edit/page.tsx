import { Link, useParams } from "orbit-router";
import { Form } from "orbit-form";
import { usePost, useUpdatePost, useEditPostForm } from "../../hooks";

export default function PostEdit() {
  const { id } = useParams<"/posts/:id">();
  const { data: post, isLoading, error } = usePost(id);
  const { mutate: update } = useUpdatePost(id);
  const form = useEditPostForm(post ?? undefined);

  const handleSubmit = async (data: { title: string; body: string }) => {
    await update(data);
    alert("Updated!");
  };

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error.message}</p>;
  if (!post) return <p className="text-gray-500">Post not found</p>;

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Post</h1>

      <Form form={form} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            {...form.register("title")}
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          {form.fieldError("title") && (
            <p className="text-red-500 text-xs mt-1">{form.fieldError("title")}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Body</label>
          <textarea
            {...form.register("body")}
            className="w-full border rounded px-3 py-1.5 text-sm min-h-[100px]"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={form.isSubmitting || !form.isDirty}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {form.isSubmitting ? "Saving..." : "Save"}
          </button>
          {form.isDirty && <span className="text-xs text-gray-400">未保存の変更があります</span>}
        </div>
      </Form>

      <p className="mt-6 text-sm">
        <Link href={`/posts/${id}`} className="text-gray-500 hover:underline">
          &larr; Back to post
        </Link>
      </p>
    </div>
  );
}
