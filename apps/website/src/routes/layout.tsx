import { Link, useNavigation } from "orbit-router";

function NavigationProgress() {
  const { state } = useNavigation();
  if (state === "idle") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          height: "100%",
          background: "#3b82f6",
          animation: "progress 2s ease-in-out infinite",
        }}
      />
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
    <div>
      <NavigationProgress />
      <nav>
        <Link href="/">Home</Link> | <Link href="/about">About</Link> |{" "}
        <Link href="/users">Users</Link> | <Link href="/docs">Docs</Link> |{" "}
        <Link href="/blog">Blog</Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
