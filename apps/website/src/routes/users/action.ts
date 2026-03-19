import { createUser, deleteUser } from "./store";

export const action = async ({ formData }: { params: Record<string, string>; search: Record<string, string>; formData: FormData }) => {
  const intent = formData.get("intent") as string;

  if (intent === "create") {
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    if (!name || !email) {
      return { error: "Name and email are required" };
    }
    const user = await createUser(name, email);
    return { created: user };
  }

  if (intent === "delete") {
    const id = formData.get("id") as string;
    await deleteUser(id);
    return { deleted: id };
  }

  return { error: "Unknown intent" };
};
