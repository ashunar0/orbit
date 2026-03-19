export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav>
        <a href="/">Home</a> | <a href="/about">About</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
