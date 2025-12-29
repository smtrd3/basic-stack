import { useEffect } from "react";
import { useMutative } from "use-mutative";

function App() {
  const [state, update] = useMutative({ loading: true, time: null });

  useEffect(() => {
    fetch("/api/time")
      .then((res) => res.json())
      .then((data) =>
        update((s) => {
          s.loading = false;
          s.time = data.time;
        }),
      )
      .catch(() =>
        update((s) => {
          s.loading = false;
        }),
      );
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-12">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">Basic Stack</h1>
          <p className="text-zinc-500 mt-2">Minimal full-stack boilerplate with HMR on both ends</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">API Example</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm">
            <div className="text-zinc-500">GET /api/time</div>
            <div className="mt-2">
              {state.loading ? (
                <span className="text-zinc-600">Loading...</span>
              ) : state.time ? (
                <span className="text-emerald-400">{state.time}</span>
              ) : (
                <span className="text-red-400">Failed to fetch</span>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Stack</h2>
          <div className="flex flex-wrap gap-2">
            {["React", "Hono", "Tailwind", "Vite", "Bun"].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-sm text-zinc-300"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        <footer className="text-zinc-600 text-sm">
          Edit <code className="text-zinc-400">src/App.jsx</code> to get started
        </footer>
      </div>
    </div>
  );
}

export default App;
