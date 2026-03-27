export interface Article {
  id: string
  title: string
  body: string
  category: "tech" | "design" | "business"
  createdAt: string
}

const articles: Article[] = [
  { id: "1", title: "React Compiler の仕組み", body: "React Compiler は自動メモ化を実現する...", category: "tech", createdAt: "2026-03-01" },
  { id: "2", title: "デザイントークンの設計", body: "デザイントークンを使うとデザインの一貫性が...", category: "design", createdAt: "2026-03-02" },
  { id: "3", title: "スタートアップの資金調達", body: "シリーズAに向けた準備として...", category: "business", createdAt: "2026-03-03" },
  { id: "4", title: "TypeScript 5.8 の新機能", body: "erasableSyntaxOnly フラグが追加され...", category: "tech", createdAt: "2026-03-04" },
  { id: "5", title: "アクセシビリティの基本", body: "WCAG 2.2 のガイドラインに沿って...", category: "design", createdAt: "2026-03-05" },
  { id: "6", title: "OKR の運用方法", body: "四半期ごとの OKR レビューでは...", category: "business", createdAt: "2026-03-06" },
  { id: "7", title: "Vite 7 のパフォーマンス改善", body: "Rolldown ベースのバンドラにより...", category: "tech", createdAt: "2026-03-07" },
  { id: "8", title: "色彩理論とUI設計", body: "補色と類似色の使い分けが...", category: "design", createdAt: "2026-03-08" },
  { id: "9", title: "プロダクトマネジメント入門", body: "ユーザーインタビューの設計から...", category: "business", createdAt: "2026-03-09" },
  { id: "10", title: "useSyncExternalStore 完全理解", body: "外部ストアとReactの同期を...", category: "tech", createdAt: "2026-03-10" },
  { id: "11", title: "レスポンシブデザインの最前線", body: "Container Queries の実用化が...", category: "design", createdAt: "2026-03-11" },
  { id: "12", title: "リモートチームのマネジメント", body: "非同期コミュニケーションを軸に...", category: "business", createdAt: "2026-03-12" },
]

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function fetchArticles(signal?: AbortSignal): Promise<Article[]> {
  await delay(400)
  signal?.throwIfAborted()
  return [...articles]
}
