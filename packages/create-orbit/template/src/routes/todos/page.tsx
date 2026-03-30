import { Link } from "orbit-router";
import { Form } from "orbit-form";
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo, useTodoForm } from "./hooks";

export default function Todos() {
  const { data: todos, isLoading } = useTodos();
  const form = useTodoForm();
  const { mutate: create } = useCreateTodo();
  const { mutate: toggle } = useToggleTodo();
  const { mutate: remove } = useDeleteTodo();

  if (isLoading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Todos</h1>

      <Form form={form} onSubmit={create} className="flex gap-2 mb-6">
        <input
          {...form.register("title")}
          placeholder="What needs to be done?"
          className="flex-1 border rounded px-3 py-1.5 text-sm"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm">
          Add
        </button>
      </Form>

      <ul className="space-y-2">
        {todos?.map((todo) => (
          <li key={todo.id} className="flex items-center gap-2 border rounded px-3 py-2">
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggle(todo.id)}
              className="cursor-pointer"
            />
            <span className={`flex-1 ${todo.done ? "line-through text-gray-400" : ""}`}>
              {todo.title}
            </span>
            <button
              onClick={() => remove(todo.id)}
              className="text-red-400 hover:text-red-600 text-xs cursor-pointer"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-6 text-sm">
        <Link href="/" className="text-gray-500 hover:underline">
          &larr; Home
        </Link>
      </div>
    </div>
  );
}
