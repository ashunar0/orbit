#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { createInterface } from "node:readline";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEMPLATE_DIR = resolve(__dirname, "..", "template");

const CLAUDE_MD = `# CLAUDE.md

## プロジェクト概要

<!-- プロジェクトの説明を書く -->

## コマンド

\`\`\`bash
pnpm install    # 依存インストール
pnpm dev        # 開発サーバー起動 (http://localhost:5173)
pnpm build      # プロダクションビルド
pnpm preview    # ビルド結果プレビュー
\`\`\`

## 技術スタック

- **ツールチェーン**: Vite+（Rolldown, Oxlint, Oxfmt）
- **UI**: React 19
- **ルーティング**: orbit-router（ディレクトリベース）
- **データ取得**: orbit-query
- **フォーム**: orbit-form（React Compiler 互換）
- **バリデーション**: Zod
- **CSS**: Tailwind CSS

## ディレクトリ規約

\`\`\`
src/routes/page.tsx              → /
src/routes/layout.tsx            → ルートレイアウト
src/routes/about/page.tsx        → /about
src/routes/users/[id]/page.tsx   → /users/:id
\`\`\`

### ファイル規約

- \`page.tsx\` — ページコンポーネント（「目次」として読めること）
- \`hooks.ts\` — カスタムフック（1フック1関心事）
- \`server.ts\` — サーバー側データアクセス関数
- \`schema.ts\` — Zod スキーマ + 型定義
- \`layout.tsx\` — レイアウト（\`{children}\` で子を囲む）
- \`loading.tsx\` — ローディング状態
- \`error.tsx\` — エラー境界
- \`not-found.tsx\` — 404 ページ

### page.tsx のデータフロー

\`\`\`tsx
const [search, setSearch] = useSearchParams(searchSchema); // State
const { data: tasks } = useTasks();                        // Fetch
const filtered = useTaskFilter(tasks, search.q);           // Transform
const { mutate: toggle } = useToggleTask();                // Mutate
return <div>...</div>;                                     // Render
\`\`\`

## 設計思想

- **読みやすさ > 書きやすさ** — 短さのために処理を隠さない
- **隠すな、揃えろ** — 暗黙の動作より明示的なコード
- **React Compiler 前提** — useMemo / useCallback / React.memo は書かない
- **YAGNI** — 必要になるまで作らない
`;

const AGENTS_MD = `# AGENTS.md

## Project Overview

<!-- Describe your project here -->

## Commands

\`\`\`bash
pnpm install    # Install dependencies
pnpm dev        # Start dev server (http://localhost:5173)
pnpm build      # Production build
pnpm preview    # Preview build
\`\`\`

## Tech Stack

- **Toolchain**: Vite+ (Rolldown, Oxlint, Oxfmt)
- **UI**: React 19
- **Routing**: orbit-router (directory-based)
- **Data Fetching**: orbit-query
- **Forms**: orbit-form (React Compiler compatible)
- **Validation**: Zod
- **CSS**: Tailwind CSS

## Directory Conventions

\`\`\`
src/routes/page.tsx              → /
src/routes/layout.tsx            → Root layout
src/routes/about/page.tsx        → /about
src/routes/users/[id]/page.tsx   → /users/:id
\`\`\`

### File Conventions

- \`page.tsx\` — Page component (should read like a table of contents)
- \`hooks.ts\` — Custom hooks (one concern per hook)
- \`server.ts\` — Server-side data access functions
- \`schema.ts\` — Zod schemas + type definitions
- \`layout.tsx\` — Layout (\`{children}\` wrapper)
- \`loading.tsx\` — Loading state
- \`error.tsx\` — Error boundary
- \`not-found.tsx\` — 404 page

### Data Flow in page.tsx

\`\`\`tsx
const [search, setSearch] = useSearchParams(searchSchema); // State
const { data: tasks } = useTasks();                        // Fetch
const filtered = useTaskFilter(tasks, search.q);           // Transform
const { mutate: toggle } = useToggleTask();                // Mutate
return <div>...</div>;                                     // Render
\`\`\`

## Design Philosophy

- **Readability > Writability** — Don't hide logic for brevity
- **Explicit over implicit** — No magic, align everything
- **React Compiler first** — No useMemo / useCallback / React.memo
- **YAGNI** — Don't build it until you need it
`;

// --- Helpers ---

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function select(rl, question, options) {
  return new Promise((resolve) => {
    console.log(question);
    options.forEach((opt, i) => console.log(`  ${i + 1}. ${opt.label}`));
    rl.question(`\n  Choose [1-${options.length}]: `, (answer) => {
      const idx = parseInt(answer, 10) - 1;
      resolve(options[idx]?.value ?? options[0].value);
    });
  });
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const projectName = args[0];

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log();
  console.log("  ◎ create-orbit");
  console.log();

  const name = projectName || (await prompt(rl, "  Project name: "));
  if (!name) {
    console.log("  Project name is required.");
    rl.close();
    process.exit(1);
  }

  const agent = await select(rl, "\n  AI instructions file:", [
    { label: "CLAUDE.md  (Claude Code)", value: "claude" },
    { label: "AGENTS.md  (Other AI tools)", value: "agents" },
    { label: "None", value: "none" },
  ]);

  rl.close();

  const targetDir = resolve(process.cwd(), name);

  if (existsSync(targetDir)) {
    console.log(`\n  Directory "${name}" already exists.`);
    process.exit(1);
  }

  // Copy template
  cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

  // Rename _gitignore to .gitignore (npm strips .gitignore from published packages)
  const gitignoreSrc = join(targetDir, "_gitignore");
  const gitignoreDest = join(targetDir, ".gitignore");
  if (existsSync(gitignoreSrc)) {
    const { renameSync } = await import("node:fs");
    renameSync(gitignoreSrc, gitignoreDest);
  }

  // Update package.json name
  const pkgPath = join(targetDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  pkg.name = basename(name);
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  // Update index.html title
  const htmlPath = join(targetDir, "index.html");
  let html = readFileSync(htmlPath, "utf-8");
  html = html.replace("{{PROJECT_NAME}}", basename(name));
  writeFileSync(htmlPath, html);

  // Write agent file
  if (agent === "claude") {
    writeFileSync(join(targetDir, "CLAUDE.md"), CLAUDE_MD);
  } else if (agent === "agents") {
    writeFileSync(join(targetDir, "AGENTS.md"), AGENTS_MD);
  }

  // Install dependencies
  console.log();
  console.log("  Installing dependencies...");
  try {
    execSync("pnpm install", { cwd: targetDir, stdio: "inherit" });
  } catch {
    console.log("  ⚠ pnpm install failed. Run it manually after setup.");
  }

  // Git init
  try {
    execSync("git init", { cwd: targetDir, stdio: "ignore" });
    execSync("git add -A", { cwd: targetDir, stdio: "ignore" });
    execSync('git commit -m "init: create-orbit"', {
      cwd: targetDir,
      stdio: "ignore",
    });
  } catch {
    // git not available, skip silently
  }

  console.log();
  console.log(`  ✓ Project created at ./${name}`);
  console.log();
  console.log("  Next steps:");
  console.log(`    cd ${name}`);
  console.log("    pnpm dev");
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
