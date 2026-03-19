import { Link } from "orbit-router";

export default function GuidePage() {
  return (
    <div>
      <h1>Getting Started Guide</h1>
      <p>
        This page is wrapped in <strong>3 nested layouts</strong>:
      </p>
      <ol>
        <li>
          <code>routes/layout.tsx</code> — Root layout (nav bar)
        </li>
        <li>
          <code>routes/docs/layout.tsx</code> — Docs layout (green border)
        </li>
        <li>
          <code>routes/docs/guide/layout.tsx</code> — Guide layout (orange
          border)
        </li>
      </ol>
      <p>
        <Link href="/docs">← Back to docs</Link>
      </p>
    </div>
  );
}
