import { getUser } from "../store";

export const loader = async ({ params }: { params: Record<string, string> }) => {
  const user = await getUser(params.id);
  if (!user) {
    throw new Error(`User #${params.id} not found`);
  }
  return { user };
};
