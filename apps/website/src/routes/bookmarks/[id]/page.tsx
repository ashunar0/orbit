import { Link, useParams } from "orbit-router"
import { useBookmark } from "../hooks"

export default function BookmarkDetail() {
  const { id } = useParams<"/bookmarks/:id">()
  const { data: bookmark, isLoading, error } = useBookmark(id)

  if (isLoading) return <p className="text-gray-500">Loading...</p>
  if (error) return <p className="text-red-600">Error: {error.message}</p>
  if (!bookmark) return <p className="text-gray-500">Bookmark not found</p>

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">{bookmark.title}</h1>
      <p>
        <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
          {bookmark.url}
        </a>
      </p>
      {bookmark.description && <p className="mt-2 text-gray-700">{bookmark.description}</p>}
      {bookmark.tags.length > 0 && (
        <div className="mt-3 flex gap-1 flex-wrap">
          {bookmark.tags.map((tag) => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">Added: {bookmark.createdAt}</p>
      <div className="mt-6 flex gap-3 text-sm">
        <Link href={`/bookmarks/${id}/edit`} className="text-blue-600 hover:underline">Edit</Link>
        <Link href="/bookmarks" className="text-gray-500 hover:underline">&larr; Back</Link>
      </div>
    </div>
  )
}
