const fakeUsers: Record<string, { id: string; name: string; email: string }> = {
  "1": { id: "1", name: "Alice", email: "alice@example.com" },
  "2": { id: "2", name: "Bob", email: "bob@example.com" },
  "3": { id: "3", name: "Charlie", email: "charlie@example.com" },
};

export const loader = async ({ params }: { params: Record<string, string> }) => {
  // ネットワーク遅延をシミュレート
  await new Promise((r) => setTimeout(r, 500));

  const user = fakeUsers[params.id];
  if (!user) {
    throw new Error(`User #${params.id} not found`);
  }
  return { user };
};
