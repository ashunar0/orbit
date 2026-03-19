import { Link } from "orbit-router";

export default function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
      <h1 style={{ fontSize: "3rem", margin: "0 0 0.5rem" }}>404</h1>
      <p style={{ fontSize: "1.2rem", color: "#666", margin: "0 0 2rem" }}>
        Page not found
      </p>
      <Link href="/" style={{ color: "#3b82f6", textDecoration: "underline" }}>
        Back to Home
      </Link>
    </div>
  );
}
