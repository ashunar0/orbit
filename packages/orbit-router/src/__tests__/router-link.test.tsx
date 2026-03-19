// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { Router } from "../runtime/router";
import { Link } from "../runtime/link";
import { useParams } from "../runtime/hooks";

function HomePage() {
  return <div>Home Page</div>;
}

function AboutPage() {
  return <div>About Page</div>;
}

function UserPage() {
  const { id } = useParams();
  return <div>User {id}</div>;
}

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="root-layout">
      <nav>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
      </nav>
      {children}
    </div>
  );
}

function UsersLayout({ children }: { children: React.ReactNode }) {
  return <div data-testid="users-layout">{children}</div>;
}

const routes = [
  { path: "/", component: HomePage, layouts: [RootLayout] },
  { path: "/about", component: AboutPage, layouts: [RootLayout] },
  { path: "/users/:id", component: UserPage, layouts: [RootLayout, UsersLayout] },
];

describe("Router", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/");
  });

  afterEach(cleanup);

  it("renders matching route for /", () => {
    render(<Router routes={routes} />);
    expect(screen.getByText("Home Page")).toBeDefined();
  });

  it("renders matching route for /about", () => {
    window.history.pushState(null, "", "/about");
    render(<Router routes={routes} />);
    expect(screen.getByText("About Page")).toBeDefined();
  });

  it("renders fallback when no route matches", () => {
    window.history.pushState(null, "", "/unknown");
    render(<Router routes={routes} />);
    expect(screen.getByText(/No routes found/)).toBeDefined();
  });

  it("wraps page in layout", () => {
    render(<Router routes={routes} />);
    expect(screen.getByTestId("root-layout")).toBeDefined();
  });

  it("applies nested layouts", () => {
    window.history.pushState(null, "", "/users/42");
    render(<Router routes={routes} />);
    expect(screen.getByTestId("root-layout")).toBeDefined();
    expect(screen.getByTestId("users-layout")).toBeDefined();
    expect(screen.getByText("User 42")).toBeDefined();
  });
});

describe("Link", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/");
  });

  afterEach(cleanup);

  it("renders an anchor element with href", () => {
    render(<Router routes={routes} />);
    const link = screen.getByText("About") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/about");
  });

  it("navigates on click without page reload", () => {
    render(<Router routes={routes} />);
    expect(screen.getByText("Home Page")).toBeDefined();

    fireEvent.click(screen.getByText("About"));
    expect(screen.getByText("About Page")).toBeDefined();
    expect(window.location.pathname).toBe("/about");
  });

  it("does not prevent default on meta+click", () => {
    render(<Router routes={routes} />);
    fireEvent.click(screen.getByText("About"), { metaKey: true });
    // Should stay on home page since navigation was not intercepted
    expect(screen.getByText("Home Page")).toBeDefined();
  });

  it("does not prevent default on ctrl+click", () => {
    render(<Router routes={routes} />);
    fireEvent.click(screen.getByText("About"), { ctrlKey: true });
    expect(screen.getByText("Home Page")).toBeDefined();
  });
});
