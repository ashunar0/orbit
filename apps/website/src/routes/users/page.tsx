import { Link } from "orbit-router";

const users = [
  { id: "1", name: "あさひ", email: "asahi@example.com" },
  { id: "2", name: "ゆうき", email: "yuki@example.com" },
];

export default function Users() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Users ({users.length})</h1>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Name</th>
            <th className="text-left py-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-2">
                <Link href={`/users/${u.id}`} className="text-blue-600 hover:underline">
                  {u.name}
                </Link>
              </td>
              <td className="py-2 text-gray-500">{u.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
