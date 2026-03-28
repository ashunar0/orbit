#!/bin/bash
set -euo pipefail

# Usage: cd <vp create で作ったディレクトリ> && bash <path-to>/setup-orbit-app.sh
# 前提: vp create 済み、pnpm-lock.yaml が存在すること

if [ ! -f "package.json" ]; then
  echo "Error: package.json が見つかりません。vp create で作ったディレクトリで実行してください。"
  exit 1
fi

echo "==> Orbit セットアップ開始"

# --- 依存パッケージ ---
echo "==> 依存パッケージを追加"
pnpm add react react-dom orbit-router orbit-query orbit-form zod
pnpm add -D @types/react @types/react-dom @vitejs/plugin-react @tailwindcss/vite tailwindcss

# --- vite.config.ts ---
echo "==> vite.config.ts を上書き"
cat > vite.config.ts << 'VITE_EOF'
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { orbitRouter } from "orbit-router";

export default defineConfig({
  plugins: [tailwindcss(), react(), orbitRouter()],
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
});
VITE_EOF

# --- tsconfig.json ---
echo "==> tsconfig.json を上書き"
cat > tsconfig.json << 'TS_EOF'
{
  "compilerOptions": {
    "target": "ES2023",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "orbit-router/client"],
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
TS_EOF

# --- index.html ---
echo "==> index.html のエントリを .tsx に変更"
sed -i '' 's|src="/src/main.ts"|src="/src/main.tsx"|' index.html

# --- テンプレートファイルを削除 ---
echo "==> テンプレートファイルを削除"
rm -f src/main.ts src/counter.ts src/style.css

# --- src/app.css ---
echo "==> src/app.css を作成"
cat > src/app.css << 'CSS_EOF'
@import "tailwindcss";
CSS_EOF

# --- src/main.tsx ---
echo "==> src/main.tsx を作成"
cat > src/main.tsx << 'MAIN_EOF'
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { App } from "./app";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
MAIN_EOF

# --- src/app.tsx ---
echo "==> src/app.tsx を作成"
cat > src/app.tsx << 'APP_EOF'
import { routes, NotFound } from "virtual:orbit-router/routes";
import { Router } from "orbit-router";
import { QueryProvider, createQueryClient } from "orbit-query";

const queryClient = createQueryClient();

export function App() {
  return (
    <QueryProvider client={queryClient}>
      <Router routes={routes} NotFound={NotFound} />
    </QueryProvider>
  );
}
APP_EOF

# --- src/routes/page.tsx ---
echo "==> src/routes/page.tsx を作成"
mkdir -p src/routes
cat > src/routes/page.tsx << 'PAGE_EOF'
export default function HomePage() {
  return (
    <div>
      <h1>Hello, Orbit!</h1>
    </div>
  );
}
PAGE_EOF

# --- CLAUDE.md に Orbit テンプレートを追記 ---
echo "==> CLAUDE.md に Orbit テンプレートを追記"

# スクリプトの場所から orbit リポジトリのテンプレートを探す
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/../docs/claude-md-template.md"

if [ -f "$TEMPLATE_FILE" ]; then
  echo "" >> CLAUDE.md
  # 「ここから下をコピー ↓」の次の「---」以降を抽出して追記
  sed -n '/^ここから下をコピー/,$ p' "$TEMPLATE_FILE" | tail -n +3 >> CLAUDE.md
  echo "   (テンプレートを追記しました)"
else
  echo "   (テンプレートが見つかりません: $TEMPLATE_FILE)"
  echo "   手動で docs/claude-md-template.md の内容をコピーしてください"
fi

echo ""
echo "==> セットアップ完了！"
echo "   pnpm dev で起動できます。"
