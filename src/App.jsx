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
    <div className="h-screen flex items-center justify-center">
      <div>
        <h1 className="text-4xl font-bold text-blue-600">basic-stack</h1>
        <span>Server status: {state.loading ? "Loading..." : <span className="font-bold">{state.status}</span>}</span>
        <br />
        <br />
        <div className="flex gap-2">
          <Link href="/1" className={(active) => (active ? "font-bold text-gray-700" : "text-gray-700")}>
            route-1
          </Link>
          <Link href="/2" className={(active) => (active ? "font-bold text-gray-700" : "text-gray-700")}>
            route-2
          </Link>
        </div>
        <div>
          <Switch>
            <Route path={"/1"} component={() => <span className="">[[ Route-1 content ]]</span>} />
            <Route path={"/2"} component={() => <span className="">[[ Route-2 content ]]</span>} />
          </Switch>
        </div>
      </div>
    </div>
  );
}

export default App;
