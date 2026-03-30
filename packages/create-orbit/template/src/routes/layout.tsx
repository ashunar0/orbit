import { Link } from "orbit-router";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <nav className="flex items-center gap-6 px-6 py-4 border-b bg-white">
        <Link href="/" className="font-semibold text-lg">
          ◎
        </Link>
        <Link href="/" className="text-sm hover:text-blue-600">
          Home
        </Link>
        <Link href="/about" className="text-sm hover:text-blue-600">
          About
        </Link>
      </nav>
      <main className="max-w-2xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
