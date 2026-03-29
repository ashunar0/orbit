import { Link, useParams } from "orbit-router";
import { usePost } from "../hooks";

export default function PostDetail() {
  const { id } = useParams<"/posts/:id">();
  const { data: post, isLoading, error } = usePost(id);

  if (isLoading) return <p className="text-gray-500">Loading...</p>;
  if (error) return <p className="text-red-600">Error: {error.message}</p>;
  if (!post) return <p className="text-gray-500">Post not found</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
      <p className="mb-4">{post.body}</p>
      <div className="flex gap-3 text-sm">
        <Link href={`/posts/${id}/edit`} className="text-blue-600 hover:underline">
          Edit
        </Link>
        <Link href="/posts" className="text-gray-500 hover:underline">
          &larr; Back to posts
        </Link>
      </div>
    </div>
  );
}
