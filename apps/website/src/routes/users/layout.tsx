export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Users Section</h2>
      <div className="pl-4 border-l-2 border-gray-300">{children}</div>
    </div>
  );
}
