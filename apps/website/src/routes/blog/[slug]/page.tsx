import { useParams, Link } from "orbit-router";

const postContent: Record<string, string> = {
  "hello-world": "Welcome to the blog! This is a demo of dynamic routing.",
  "orbit-router-intro":
    "Orbit Router is a directory-based router for Vite + React.",
  "nested-layouts":
    "Layouts in parent directories are automatically collected and nested.",
};

export default function BlogPost() {
  const { slug } = useParams();
  const content = postContent[slug] ?? "Post not found.";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{slug}</h1>
      <p className="mb-4">{content}</p>
      <p className="text-sm text-gray-400">
        Route: <code>/blog/[slug]</code> → param: <code>{`{ slug: "${slug}" }`}</code>
      </p>
      <Link href="/blog" className="text-gray-500 hover:underline text-sm">&larr; Back to blog</Link>
    </div>
  );
}
