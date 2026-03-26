import type { LoaderArgs } from "orbit-router";
import { getUser } from "../store";

export const loader = async ({ params }: LoaderArgs<"/users/:id">) => {
  const user = await getUser(params.id);
  if (!user) {
    throw new Error(`User #${params.id} not found`);
  }
  return { user };
};
