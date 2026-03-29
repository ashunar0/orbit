import { useQuery } from "orbit-query";
import { fetchArticles, type Article } from "./server";

/** 記事一覧を取得する */
export function useArticles() {
  return useQuery({
    key: ["articles"] as const,
    fn: ({ signal }: { signal: AbortSignal }) => fetchArticles(signal),
  });
}

/** キーワードとカテゴリで記事を絞り込む */
export function useArticleFilter(articles: Article[], q: string, category: string) {
  const filtered = articles.filter((article) => {
    const matchesQuery =
      q === "" ||
      article.title.toLowerCase().includes(q.toLowerCase()) ||
      article.body.toLowerCase().includes(q.toLowerCase());
    const matchesCategory = category === "all" || article.category === category;
    return matchesQuery && matchesCategory;
  });

  return { filtered, totalCount: filtered.length };
}

/** 配列をページ分割する */
export function usePagination<T>(items: T[], page: number, perPage = 5) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paged = items.slice((currentPage - 1) * perPage, currentPage * perPage);

  return { paged, currentPage, totalPages };
}
