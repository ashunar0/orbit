export default function ErrorPage({ error }: { error: Error }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Error</h2>
      <p className="text-red-600">{error.message}</p>
    </div>
  );
}
