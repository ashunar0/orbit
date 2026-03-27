import { Link, useSearchParams } from "orbit-router"
import { useArticles, useArticleFilter, usePagination } from "./hooks"

const CATEGORIES = ["all", "tech", "design", "business"] as const
const CATEGORY_LABELS: Record<string, string> = {
  all: "すべて",
  tech: "テック",
  design: "デザイン",
  business: "ビジネス",
}

export default function SearchDemo() {
  const [search, setSearch] = useSearchParams((raw) => ({
    q: raw.q ?? "",
    category: raw.category ?? "all",
    page: Number(raw.page ?? 1),
  }))

  // データ取得 → 絞り込み → ページ分割
  const { data: articles, isLoading, error } = useArticles()
  const { filtered, totalCount } = useArticleFilter(articles ?? [], search.q, search.category)
  const { paged, currentPage, totalPages } = usePagination(filtered, search.page)

  const hasActiveFilters = search.q !== "" || search.category !== "all"

  if (isLoading) return <p>Loading articles...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <h1>Articles</h1>

      {/* 検索 */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="キーワードで検索..."
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value, page: "1" })}
          style={{ width: "100%", padding: 8, fontSize: 14 }}
        />
      </div>

      {/* カテゴリフィルタ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSearch({ category: cat, page: "1" })}
            style={{
              padding: "4px 12px",
              border: "1px solid #ccc",
              borderRadius: 4,
              background: search.category === cat ? "#333" : "#fff",
              color: search.category === cat ? "#fff" : "#333",
              cursor: "pointer",
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={() => setSearch({ q: null, category: null, page: null })}
            style={{
              padding: "4px 12px",
              border: "1px solid #ccc",
              borderRadius: 4,
              background: "#fff",
              color: "#999",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            クリア
          </button>
        )}
      </div>

      {/* 件数 */}
      <p style={{ color: "#666", fontSize: 14, marginBottom: 12 }}>
        {totalCount} 件の記事
        {hasActiveFilters && "（フィルタ適用中）"}
      </p>

      {/* 記事一覧 */}
      {paged.length === 0 ? (
        <p style={{ color: "#999" }}>該当する記事がありません</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {paged.map((article) => (
            <li
              key={article.id}
              style={{
                padding: 12,
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 4 }}>
                {article.title}
              </div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                {article.body}
              </div>
              <div style={{ fontSize: 12, color: "#999" }}>
                <span style={{
                  background: "#f0f0f0",
                  padding: "2px 6px",
                  borderRadius: 3,
                  marginRight: 8,
                }}>
                  {CATEGORY_LABELS[article.category]}
                </span>
                {article.createdAt}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginTop: 16 }}>
          <button
            disabled={currentPage <= 1}
            onClick={() => setSearch({ page: String(currentPage - 1) })}
            style={{ padding: "4px 8px" }}
          >
            ←
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setSearch({ page: String(page) })}
              style={{
                padding: "4px 10px",
                fontWeight: page === currentPage ? "bold" : "normal",
                background: page === currentPage ? "#333" : "#fff",
                color: page === currentPage ? "#fff" : "#333",
                border: "1px solid #ccc",
                borderRadius: 4,
              }}
            >
              {page}
            </button>
          ))}
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setSearch({ page: String(currentPage + 1) })}
            style={{ padding: "4px 8px" }}
          >
            →
          </button>
        </div>
      )}

      <p style={{ marginTop: 24 }}>
        <Link href="/">← Home</Link>
      </p>
    </div>
  )
}
