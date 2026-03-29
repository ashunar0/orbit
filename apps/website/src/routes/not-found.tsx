import { Link } from "orbit-router";

export default function NotFound() {
  return (
    <div className="text-center py-16 px-4">
      <h1 className="text-5xl font-bold mb-2">404</h1>
      <p className="text-lg text-gray-500 mb-8">Page not found</p>
      <Link href="/" className="text-blue-600 hover:underline">
        Back to Home
      </Link>
    </div>
  );
}
