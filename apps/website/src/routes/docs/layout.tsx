export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Docs</h2>
      <div className="pl-4 border-l-2 border-green-400">
        {children}
      </div>
    </div>
  );
}
