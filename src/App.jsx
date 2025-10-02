import { useEffect } from "react";
import { useMutative } from "use-mutative";
import { Route, Switch, Link } from "wouter";

function App() {
  const [state, update] = useMutative({ loading: true, status: "unknown" });

  useEffect(() => {
    update((s) => {
      s.loading = true;
    });

    fetch("/api/health-check").then(async (res) => {
      update((s) => {
        s.loading = false;
      });

      const data = await res.json();

      update((s) => {
        s.status = data.status;
      });
    });
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="fixed top-0 w-full bg-black border-b border-white/20">
        <div className="p-2">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold tracking-tighter font-sans">Basic-stack</h1>
            <div className="flex gap-8">
              <Link
                href="/"
                className={(active) => (active ? "text-white" : "text-white hover:text-white transition-colors")}
              >
                Dashboard
              </Link>
              <Link
                href="/about"
                className={(active) => (active ? "text-white" : "text-white hover:text-white transition-colors")}
              >
                About
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-8 py-32">
        <div className="mb-12">
          <div className="inline-flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${state.loading ? "bg-white/30" : "bg-lime-500"}`}></div>
            <span className="text-sm ">
              Backend status: {state.loading ? "Checking..." : <b className="text-lime-500">{state.status}</b>}
            </span>
          </div>
        </div>

        <Switch>
          <Route
            path="/"
            component={() => (
              <div className="space-y-16">
                <div>
                  <h2 className="text-2xl font-medium mb-4">Welcome</h2>
                  <p className="text-white/60 max-w-2xl">
                    This is a minimal monochrome dashboard showcasing routing and API integration.
                  </p>
                </div>
              </div>
            )}
          />

          <Route
            path="/about"
            component={() => (
              <div className="max-w-2xl">
                <h2 className="text-2xl font-medium mb-8">About</h2>
                <p className="text-white/60">
                  A minimal full-stack setup with hot reloading for both frontend and backend. Opinionated, built with
                  React, Tailwind CSS, Hono, and Bun — optimized for fast iteration and simple hobby projects.
                </p>
                <h3 className="my-1 underline">Composition:</h3>
                <ul className="list-disc block pl-6">
                  <li>React</li>
                  <li>Hono</li>
                  <li>Tailwind</li>
                  <li>Vite (rolldown)</li>
                </ul>
              </div>
            )}
          />
        </Switch>
      </main>
    </div>
  );
}

export default App;
