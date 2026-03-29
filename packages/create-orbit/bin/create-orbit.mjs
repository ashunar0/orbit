#!/usr/bin/env node

import { existsSync, cpSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { resolve, basename, join } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";

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

// --- Args ---

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--agent" && argv[i + 1]) {
      flags.agent = argv[++i];
    } else if (!argv[i].startsWith("-")) {
      positional.push(argv[i]);
    }
  }
  return { name: positional[0], ...flags };
}

// --- Main ---

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isNonInteractive = args.name && args.agent;

  p.intro("◎ create-orbit");

  let options;

  if (isNonInteractive) {
    // Non-interactive: all options from CLI flags
    const valid = ["claude", "agents", "none"];
    if (!valid.includes(args.agent)) {
      p.cancel(`Invalid --agent value: "${args.agent}". Use: ${valid.join(", ")}`);
      process.exit(1);
    }
    options = { name: args.name, agent: args.agent };
    p.log.info(`Project: ${options.name}`);
    p.log.info(`Agent: ${options.agent}`);
  } else {
    // Interactive: prompt for missing options
    options = await p.group(
      {
        name: () =>
          args.name
            ? Promise.resolve(args.name)
            : p.text({
                message: "Project name",
                placeholder: "my-orbit-app",
                validate: (value) => {
                  if (!value) return "Project name is required";
                  if (existsSync(resolve(process.cwd(), value)))
                    return `Directory "${value}" already exists`;
                },
              }),
        agent: () =>
          args.agent
            ? Promise.resolve(args.agent)
            : p.select({
                message: "AI instructions file",
                options: [
                  { label: "CLAUDE.md", hint: "Claude Code", value: "claude" },
                  { label: "AGENTS.md", hint: "Other AI tools", value: "agents" },
                  { label: "None", value: "none" },
                ],
              }),
      },
      {
        onCancel: () => {
          p.cancel("Setup cancelled.");
          process.exit(0);
        },
      },
    );
  }

  const name = options.name;
  const targetDir = resolve(process.cwd(), name);

  if (existsSync(targetDir)) {
    p.cancel(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  // Copy template
  cpSync(TEMPLATE_DIR, targetDir, { recursive: true });

  // Rename _gitignore to .gitignore (npm strips .gitignore from published packages)
  const gitignoreSrc = join(targetDir, "_gitignore");
  if (existsSync(gitignoreSrc)) {
    renameSync(gitignoreSrc, join(targetDir, ".gitignore"));
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
  if (options.agent === "claude") {
    writeFileSync(join(targetDir, "CLAUDE.md"), CLAUDE_MD);
  } else if (options.agent === "agents") {
    writeFileSync(join(targetDir, "AGENTS.md"), AGENTS_MD);
  }

  // Install dependencies
  const s = p.spinner();
  s.start("Installing dependencies...");
  try {
    execSync("pnpm install", { cwd: targetDir, stdio: "ignore" });
    s.stop("Dependencies installed.");
  } catch {
    s.stop("Failed to install dependencies. Run pnpm install manually.");
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

  p.note(`cd ${name}\npnpm dev`, "Next steps");

  p.outro("Happy hacking!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
