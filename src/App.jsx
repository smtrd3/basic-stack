import { useEffect } from "react";
import { useMutative } from "use-mutative";

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
    <div className="h-screen flex items-center justify-center">
      <div>
        <h1 className="text-4xl font-bold text-blue-600">basic-stack</h1>
        <span>Server status: {state.loading ? "Loading..." : <span className="font-bold">{state.status}</span>}</span>
      </div>
    </div>
  );
}

export default App;
