import { Link } from "orbit-router";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav>
        <Link href="/">Home</Link> | <Link href="/about">About</Link> |{" "}
        <Link href="/users">Users</Link> | <Link href="/docs">Docs</Link> |{" "}
        <Link href="/blog">Blog</Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}
