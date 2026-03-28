import { Link } from "orbit-router"
import { useBookmarks, useTags, useBookmarkSearch, useDeleteBookmark, filterBookmarks } from "./hooks"

export default function Bookmarks() {
  const [search, setSearch] = useBookmarkSearch()
  const { data: bookmarks, isLoading, error } = useBookmarks()
  const { data: tags } = useTags()
  const { mutate: remove } = useDeleteBookmark()

  const filtered = filterBookmarks(bookmarks ?? [], search.q, search.tag)

  if (isLoading) return <p className="text-gray-500">Loading bookmarks...</p>
  if (error) return <p className="text-red-600">Error: {error.message}</p>

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Bookmarks ({filtered.length})</h1>

      {/* 検索 */}
      <div className="flex gap-2 mb-6">
        <input
          placeholder="Search..."
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value || null })}
          className="flex-1 border rounded px-3 py-1.5 text-sm"
        />
        <select
          value={search.tag}
          onChange={(e) => setSearch({ tag: e.target.value || null })}
          className="border rounded px-3 py-1.5 text-sm"
        >
          <option value="">All tags</option>
          {tags?.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <p className="text-gray-400">No bookmarks found.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((b) => (
            <li key={b.id} className="border rounded-lg p-3">
              <div>
                <Link href={`/bookmarks/${b.id}`} className="font-semibold text-blue-600 hover:underline">
                  {b.title}
                </Link>
              </div>
              <div className="text-sm text-gray-500">{b.url}</div>
              {b.tags.length > 0 && (
                <div className="mt-1.5 flex gap-1 flex-wrap">
                  {b.tags.map((tag) => (
                    <span
                      key={tag}
                      onClick={() => setSearch({ tag })}
                      className={`cursor-pointer text-xs px-2 py-0.5 rounded ${
                        search.tag === tag
                          ? "bg-gray-800 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs text-gray-400 space-x-2">
                <Link href={`/bookmarks/${b.id}/edit`} className="hover:text-gray-600">Edit</Link>
                <button
                  onClick={() => { if (confirm("削除しますか？")) remove(b.id) }}
                  className="text-red-400 hover:text-red-600 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/bookmarks/new" className="text-blue-600 hover:underline">+ New Bookmark</Link>
        <Link href="/" className="text-gray-500 hover:underline">&larr; Home</Link>
      </div>
    </div>
  )
}
