import { Link, useNavigation } from "orbit-router";

function NavigationProgress() {
  const { state } = useNavigation();
  if (state === "idle") return null;

  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-50">
      <div className="h-full bg-blue-500 animate-[progress_2s_ease-in-out_infinite]" />
      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 95%; }
        }
      `}</style>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavigationProgress />
      <nav className="flex gap-4 px-4 py-3 border-b text-sm">
        <Link href="/" className="hover:text-blue-600">
          Home
        </Link>
        <Link href="/about" className="hover:text-blue-600">
          About
        </Link>
        <Link href="/users" className="hover:text-blue-600">
          Users
        </Link>
        <Link href="/docs" className="hover:text-blue-600">
          Docs
        </Link>
        <Link href="/blog" className="hover:text-blue-600">
          Blog
        </Link>
      </nav>
      <main className="p-4">{children}</main>
    </div>
  );
}
