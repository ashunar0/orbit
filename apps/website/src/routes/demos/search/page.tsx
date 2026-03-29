import { Link, useSearchParams } from "orbit-router";
import { useArticles, useArticleFilter, usePagination } from "./hooks";

const CATEGORIES = ["all", "tech", "design", "business"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  all: "すべて",
  tech: "テック",
  design: "デザイン",
  business: "ビジネス",
};

export default function SearchDemo() {
  const [search, setSearch] = useSearchParams((raw) => ({
    q: raw.q ?? "",
    category: raw.category ?? "all",
    page: Number(raw.page ?? 1),
  }));

  const { data: articles, isLoading, error } = useArticles();
  const { filtered, totalCount } = useArticleFilter(articles ?? [], search.q, search.category);
  const { paged, currentPage, totalPages } = usePagination(filtered, search.page);

  const hasActiveFilters = search.q !== "" || search.category !== "all";

  if (isLoading) return <p className="text-gray-500">Loading articles...</p>;
  if (error) return <p className="text-red-600">Error: {error.message}</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Articles</h1>

      {/* 検索 */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="キーワードで検索..."
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value, page: "1" })}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      {/* カテゴリフィルタ */}
      <div className="flex gap-2 mb-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSearch({ category: cat, page: "1" })}
            className={`px-3 py-1 border rounded text-sm cursor-pointer ${
              search.category === cat
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
        {hasActiveFilters && (
          <button
            onClick={() => setSearch({ q: null, category: null, page: null })}
            className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-400 cursor-pointer hover:text-gray-600 ml-auto"
          >
            クリア
          </button>
        )}
      </div>

      {/* 件数 */}
      <p className="text-sm text-gray-500 mb-3">
        {totalCount} 件の記事{hasActiveFilters && "（フィルタ適用中）"}
      </p>

      {/* 記事一覧 */}
      {paged.length === 0 ? (
        <p className="text-gray-400">該当する記事がありません</p>
      ) : (
        <ul className="divide-y">
          {paged.map((article) => (
            <li key={article.id} className="py-3">
              <div className="font-semibold mb-1">{article.title}</div>
              <div className="text-sm text-gray-500 mb-1">{article.body}</div>
              <div className="text-xs text-gray-400">
                <span className="bg-gray-100 px-1.5 py-0.5 rounded mr-2">
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
        <div className="flex gap-1 justify-center mt-4">
          <button
            disabled={currentPage <= 1}
            onClick={() => setSearch({ page: String(currentPage - 1) })}
            className="px-2 py-1 text-sm disabled:opacity-30"
          >
            &larr;
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setSearch({ page: String(page) })}
              className={`px-2.5 py-1 border rounded text-sm cursor-pointer ${
                page === currentPage
                  ? "bg-gray-800 text-white border-gray-800"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setSearch({ page: String(currentPage + 1) })}
            className="px-2 py-1 text-sm disabled:opacity-30"
          >
            &rarr;
          </button>
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href="/" className="text-gray-500 hover:underline">
          &larr; Home
        </Link>
      </p>
    </div>
  );
}
