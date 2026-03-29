import { Link } from "orbit-router";

export default function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Welcome to Orbit</h1>
      <p className="text-gray-500 mb-6">
        Edit <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">src/routes/page.tsx</code> to get started.
      </p>
      <div className="flex gap-4 text-sm">
        <Link href="/about" className="text-blue-600 hover:underline">
          About
        </Link>
        <a
          href="https://github.com/asahi-and/orbit"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          GitHub
        </a>
      </div>
    </div>
  );
}
