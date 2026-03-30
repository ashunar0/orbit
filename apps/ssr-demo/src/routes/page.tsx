export default function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">SSR Works!</h1>
      <p className="text-gray-500">
        This page was server-side rendered with Orbit.
      </p>
      <p className="text-sm text-gray-400 mt-4">
        View source to confirm the HTML was rendered on the server.
      </p>
    </div>
  );
}
