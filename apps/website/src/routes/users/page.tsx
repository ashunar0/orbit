import { Link } from "orbit-router";

const users = [
  { id: "1", name: "あさひ", email: "asahi@example.com" },
  { id: "2", name: "ゆうき", email: "yuki@example.com" },
];

export default function Users() {
  return (
    <div>
      <h1>Users ({users.length})</h1>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><Link href={`/users/${u.id}`}>{u.name}</Link></td>
              <td>{u.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
