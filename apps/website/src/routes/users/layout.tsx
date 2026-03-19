export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2>Users Section</h2>
      <div style={{ paddingLeft: 16, borderLeft: "2px solid #ccc" }}>
        {children}
      </div>
    </div>
  );
}
