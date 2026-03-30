import { useQuery, useMutation } from "orbit-query";
import { useForm } from "orbit-form";
import { getTodos, createTodo, toggleTodo, deleteTodo } from "./server";
import { todoFormSchema } from "./schema";

// ── Queries ──

export function useTodos() {
  return useQuery({
    key: ["todos"] as const,
    fn: () => getTodos(),
  });
}

// ── Mutations ──

export function useCreateTodo() {
  return useMutation({
    fn: createTodo,
    invalidate: ["todos"],
  });
}

export function useToggleTodo() {
  return useMutation({
    fn: toggleTodo,
    invalidate: ["todos"],
  });
}

export function useDeleteTodo() {
  return useMutation({
    fn: deleteTodo,
    invalidate: ["todos"],
  });
}

// ── Forms ──

export function useTodoForm() {
  return useForm({ schema: todoFormSchema, defaultValues: { title: "" } });
}
