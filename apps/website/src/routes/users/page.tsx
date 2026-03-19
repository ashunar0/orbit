import { Link } from "orbit-router";

const users = [
  { id: "1", name: "Alice" },
  { id: "2", name: "Bob" },
  { id: "3", name: "Charlie" },
];

export default function Users() {
  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/users/${u.id}`}>{u.name}</Link>
          </li>
        ))}
        <li>
          <Link href="/users/999">Unknown user (error demo)</Link>
        </li>
      </ul>
    </div>
  );
}
