import { useLoaderData, Link } from "orbit-router";
import type { loader } from "./loader";

export default function UserDetail() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
      <Link href="/users">← Back to users</Link>
    </div>
  );
}
