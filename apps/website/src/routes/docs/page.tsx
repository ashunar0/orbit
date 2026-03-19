import { Link } from "orbit-router";

export default function DocsIndex() {
  return (
    <div>
      <h1>Documentation</h1>
      <p>This section demonstrates nested layouts (2 levels deep).</p>
      <ul>
        <li>
          <Link href="/docs/guide">Guide</Link> — 3 levels of nested layouts
        </li>
      </ul>
    </div>
  );
}
