import { useParams, Link } from "orbit-router";

export default function UserDetail() {
  const { id } = useParams();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">User {id}</h1>
      <Link href="/users" className="text-gray-500 hover:underline text-sm">
        &larr; Back to users
      </Link>
    </div>
  );
}
