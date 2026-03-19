export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2>📖 Docs</h2>
      <div style={{ paddingLeft: 16, borderLeft: "2px solid #6c8" }}>
        {children}
      </div>
    </div>
  );
}
