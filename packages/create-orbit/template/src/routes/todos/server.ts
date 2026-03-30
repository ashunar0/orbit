import type { Todo, TodoForm } from "./schema";

// ── インメモリストア（RPC 導入後は DB に置き換え） ──

let nextId = 3;

const todos: Todo[] = [
  { id: "1", title: "Orbit を試す", done: true },
  { id: "2", title: "RPC で API を作る", done: false },
];

// ── Queries ──

export async function getTodos(): Promise<Todo[]> {
  return [...todos];
}

// ── Mutations ──

export async function createTodo(input: TodoForm): Promise<Todo> {
  const todo: Todo = { id: String(nextId++), title: input.title, done: false };
  todos.push(todo);
  return todo;
}

export async function toggleTodo(id: string): Promise<Todo> {
  const todo = todos.find((t) => t.id === id);
  if (!todo) throw new Error("Todo not found");
  todo.done = !todo.done;
  return { ...todo };
}

export async function deleteTodo(id: string): Promise<void> {
  const idx = todos.findIndex((t) => t.id === id);
  if (idx !== -1) todos.splice(idx, 1);
}
