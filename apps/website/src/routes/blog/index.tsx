import { Link } from "orbit-router";

const posts = [
  { slug: "hello-world", title: "Hello World" },
  { slug: "orbit-router-intro", title: "Introducing Orbit Router" },
  { slug: "nested-layouts", title: "Understanding Nested Layouts" },
];

export default function BlogIndex() {
  return (
    <div>
      <h1>Blog</h1>
      <p>
        Dynamic routes with <code>[slug]</code> parameter pattern.
      </p>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
