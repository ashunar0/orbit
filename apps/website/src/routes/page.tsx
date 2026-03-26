import { Link } from "orbit-router";

export default function Home() {
  return (
    <div>
      <h1>Home</h1>
      <p>Welcome to Orbit Router!</p>
      <Link href="/about">About</Link>
      {" | "}
      <Link href="/posts">Posts (orbit-query demo)</Link>
    </div>
  );
}
