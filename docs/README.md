# Orbit — ドキュメント

## 今読むべきドキュメント（設計思想）

この3つを上から順に読めば、Orbit の設計が理解できる。

| 順番 | ファイル                                   | 内容                                                                 |
| ---- | ------------------------------------------ | -------------------------------------------------------------------- |
| 1    | [philosophy.md](philosophy.md)             | なぜ — 読みやすさ優先、理解負債ゼロ                                  |
| 2    | [architecture.md](architecture.md)         | どう組み立てるか — 認知負荷、データフロー、Progressive Decomposition |
| 3    | [file-conventions.md](file-conventions.md) | どこに何を置くか — page / hooks / server / schema                    |

## パッケージ設計書

各パッケージの詳細な設計判断を記録したもの。実装時のリファレンス。

| ファイル                                       | 内容                                             |
| ---------------------------------------------- | ------------------------------------------------ |
| [orbit-query-design.md](orbit-query-design.md) | orbit-query の API 設計、React Compiler 互換性   |
| [orbit-form-design.md](orbit-form-design.md)   | orbit-form の API 設計、フィールド購読、依存関係 |

## その他

| ファイル / ディレクトリ                        | 内容                                                          |
| ---------------------------------------------- | ------------------------------------------------------------- |
| [quality-guide.md](quality-guide.md)           | コードレビュー・テスト・セキュリティの運用ガイド              |
| [claude-md-template.md](claude-md-template.md) | 新規プロジェクト向け CLAUDE.md テンプレート                   |
| [notes/](notes/)                               | 学習メモ（SSR、ハッカソンフィードバック、Phase 2 振り返り等） |
| [blog/](blog/)                                 | 開発ブログの下書き                                            |
| [archive/](archive/)                           | 完了済みチケット、旧要件定義（履歴として保存）                |
