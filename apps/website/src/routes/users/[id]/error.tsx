export default function ErrorPage({ error }: { error: Error }) {
  return (
    <div>
      <h2>Error</h2>
      <p style={{ color: "red" }}>{error.message}</p>
    </div>
  );
}
