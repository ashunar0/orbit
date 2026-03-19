import { useState } from "react";
import { Link, useLoaderData, useSubmit, useActionData } from "orbit-router";
import type { loader } from "./loader";
import type { action } from "./action";

export default function Users() {
  const { users } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set("intent", "create");
    fd.set("name", name);
    fd.set("email", email);
    submit(fd);
    setName("");
    setEmail("");
  };

  const handleDelete = (id: string) => {
    const fd = new FormData();
    fd.set("intent", "delete");
    fd.set("id", id);
    submit(fd);
  };

  return (
    <div>
      <h1>Users ({users.length})</h1>

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><Link href={`/users/${u.id}`}>{u.name}</Link></td>
              <td>{u.email}</td>
              <td><button onClick={() => handleDelete(u.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add User</h2>
      {actionData && "error" in actionData && (
        <p style={{ color: "red" }}>{actionData.error}</p>
      )}
      <form onSubmit={handleCreate}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>

      <p>
        <Link href="/users/999">Unknown user (error demo)</Link>
      </p>
    </div>
  );
}
