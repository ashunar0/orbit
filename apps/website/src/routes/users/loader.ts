import { getUsers } from "./store";

export const loader = async () => {
  const users = await getUsers();
  return { users };
};
