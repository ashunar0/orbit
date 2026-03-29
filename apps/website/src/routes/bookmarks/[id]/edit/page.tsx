import { Link, useParams, useNavigate } from "orbit-router";
import { Form } from "orbit-form";
import { useBookmark, useUpdateBookmark, useEditBookmarkForm } from "../../hooks";

export default function EditBookmark() {
  const { id } = useParams<"/bookmarks/:id">();
  const navigate = useNavigate();
  const { data: bookmark, isLoading, error } = useBookmark(id);
  const { mutate: update } = useUpdateBookmark(id);

  const form = useEditBookmarkForm(
    bookmark
      ? {
          url: bookmark.url,
          title: bookmark.title,
          description: bookmark.description,
          tags: bookmark.tags.join(", "),
        }
      : undefined,
  );

  const handleSubmit = async (data: {
    url: string;
    title: string;
    description: string;
    tags: string;
  }) => {
    await update(data);
    navigate(`/bookmarks/${id}`);
  };

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error.message}</p>;
  if (!bookmark) return <p className="text-gray-500">Bookmark not found</p>;

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Bookmark</h1>

      <Form form={form} onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">URL</label>
          <input {...form.register("url")} className="w-full border rounded px-3 py-1.5 text-sm" />
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
          <input {...form.register("tags")} className="w-full border rounded px-3 py-1.5 text-sm" />
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
        <Link href={`/bookmarks/${id}`} className="text-gray-500 hover:underline">
          &larr; Back
        </Link>
      </p>
    </div>
  );
}
