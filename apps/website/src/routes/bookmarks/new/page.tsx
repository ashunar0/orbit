import { Link, useNavigate } from "orbit-router";
import { Form } from "orbit-form";
import { useCreateBookmark, useCreateBookmarkForm } from "../hooks";

export default function NewBookmark() {
  const navigate = useNavigate();
  const form = useCreateBookmarkForm();
  const { mutate: create } = useCreateBookmark();

  const handleSubmit = async (data: {
    url: string;
    title: string;
    description: string;
    tags: string;
  }) => {
    await create(data);
    navigate("/bookmarks");
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">New Bookmark</h1>

      <Form form={form} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">URL</label>
          <input
            {...form.register("url")}
            placeholder="https://..."
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
          {form.fieldError("url") && (
            <p className="text-red-500 text-xs mt-1">{form.fieldError("url")}</p>
          )}
        </div>
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
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            {...form.register("description")}
            className="w-full border rounded px-3 py-1.5 text-sm min-h-[60px]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
          <input
            {...form.register("tags")}
            placeholder="react, docs"
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={form.isSubmitting}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {form.isSubmitting ? "Saving..." : "Save"}
        </button>
      </Form>

      <p className="mt-6 text-sm">
        <Link href="/bookmarks" className="text-gray-500 hover:underline">
          &larr; Back
        </Link>
      </p>
    </div>
  );
}
