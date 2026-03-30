import { z } from "zod";

export const todoSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  done: z.boolean(),
});
export type Todo = z.infer<typeof todoSchema>;

export const todoFormSchema = todoSchema.pick({ title: true });
export type TodoForm = z.infer<typeof todoFormSchema>;
