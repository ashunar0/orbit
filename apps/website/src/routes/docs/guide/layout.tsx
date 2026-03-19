export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h3>📝 Guide</h3>
      <div style={{ paddingLeft: 16, borderLeft: "2px solid #c86" }}>
        {children}
      </div>
    </div>
  );
}
