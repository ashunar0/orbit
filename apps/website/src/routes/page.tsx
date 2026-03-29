import { Link } from "orbit-router";

export default function Home() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Home</h1>
      <p className="text-gray-500 mb-4">Welcome to Orbit Router!</p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/about" className="text-blue-600 hover:underline">
          About
        </Link>
        <Link href="/posts" className="text-blue-600 hover:underline">
          Posts
        </Link>
        <Link href="/bookmarks" className="text-blue-600 hover:underline">
          Bookmarks
        </Link>
        <Link href="/demos/search" className="text-blue-600 hover:underline">
          Search Demo
        </Link>
        <Link href="/demos/form" className="text-blue-600 hover:underline">
          Form Demo
        </Link>
      </div>
    </div>
  );
}
