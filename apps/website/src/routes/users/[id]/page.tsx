import { useParams, Link } from "orbit-router";

export default function UserDetail() {
  const { id } = useParams();

  return (
    <div>
      <h1>User #{id}</h1>
      <p>This is the detail page for user {id}.</p>
      <Link href="/users">← Back to users</Link>
    </div>
  );
}
