import { useEffect } from "react";
import { useMutative } from "use-mutative";

// Recursive variants, see src/fonts.css
const FONT_VARIANTS = [
  { name: "Sans Linear", className: "font-sans" },
  { name: "Sans Casual", className: "font-casual" },
  { name: "Mono Linear", className: "font-mono" },
  { name: "Mono Casual", className: "font-mono casual" },
];

const FONT_WEIGHTS = [
  { weight: 300, className: "font-light" },
  { weight: 400, className: "font-normal" },
  { weight: 500, className: "font-medium" },
  { weight: 600, className: "font-semibold" },
  { weight: 700, className: "font-bold" },
  { weight: 800, className: "font-extrabold" },
  { weight: 900, className: "font-black" },
  { weight: 1000, className: "font-extrablack" },
];

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

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
            Typeface · Recursive
          </h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg divide-y divide-zinc-800">
            {FONT_VARIANTS.map(({ name, className }) => (
              <div key={name} className={`${className} p-4 space-y-1`}>
                <div className="text-xs text-zinc-500">
                  {name} <span className="text-zinc-600">· {className}</span>
                </div>
                <div className="text-xl font-medium">
                  Quick fox <span className="italic">jumps</span>{" "}
                  <span className="font-bold">over</span> the lazy dog
                </div>
              </div>
            ))}
            <div className="p-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {FONT_WEIGHTS.map(({ weight, className }) => (
                <span key={weight} className={`${className} text-lg`} title={className}>
                  {weight}
                </span>
              ))}
              <span className="italic font-extrablack text-lg">Italic</span>
            </div>
          </div>
        </section>

        <footer className="text-zinc-600 text-sm">
          Edit <code className="text-zinc-400">src/App.tsx</code> to get started
        </footer>
      </div>
    </div>
  );
}

export default App;
