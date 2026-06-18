import { useAuthCtx } from "../App";
import { useRunState } from "../hooks/useRunState";
import { useQueueStats } from "../hooks/useQueueStats";
import StatCards from "../components/StatCards";
import RunControls from "../components/RunControls";

export default function Dashboard() {
  const { isAdmin } = useAuthCtx();
  const { runState, reload: reloadRun } = useRunState();
  const { stats, reload: reloadStats } = useQueueStats();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
      <StatCards stats={stats} />
      {runState && (
        <RunControls
          runState={runState}
          isAdmin={isAdmin}
          onChange={() => {
            reloadRun();
            reloadStats();
          }}
        />
      )}
    </div>
  );
}
