export interface User {
  id: string;
  name: string;
  email: string;
}

let nextId = 4;

const users: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
  { id: "3", name: "Charlie", email: "charlie@example.com" },
];

// 遅延をシミュレート
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getUsers(): Promise<User[]> {
  await delay(300);
  return [...users];
}

export async function getUser(id: string): Promise<User | undefined> {
  await delay(300);
  return users.find((u) => u.id === id);
}

export async function createUser(name: string, email: string): Promise<User> {
  await delay(200);
  const user: User = { id: String(nextId++), name, email };
  users.push(user);
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  await delay(200);
  const idx = users.findIndex((u) => u.id === id);
  if (idx !== -1) users.splice(idx, 1);
}
