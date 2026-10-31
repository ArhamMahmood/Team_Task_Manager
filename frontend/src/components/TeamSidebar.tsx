import type { Team } from '../api/types';

type Props = {
  teams: Team[];
  selectedTeamId: number | null;
  currentUserId: number;
  onSelect: (teamId: number | null) => void;
  onCreate: () => void;
  onOpenMembers: (team: Team) => void;
  onDeleteTeam: (team: Team) => void;
};

export function TeamSidebar({
  teams,
  selectedTeamId,
  currentUserId,
  onSelect,
  onCreate,
  onOpenMembers,
  onDeleteTeam,
}: Props) {
  return (
    <aside className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Teams
        </h2>
        <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={onCreate}>
          + New team
        </button>
      </div>

      <nav
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        aria-label="Teams"
      >
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-current={selectedTeamId === null ? 'true' : undefined}
          className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition lg:w-full ${
            selectedTeamId === null
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          All teams
        </button>

        {teams.map((team) => {
          const active = selectedTeamId === team.id;
          const isOwner = team.createdBy === currentUserId;

          return (
            <div
              key={team.id}
              className={`shrink-0 rounded-lg border transition lg:w-full ${
                active ? 'border-indigo-200 bg-indigo-50/60' : 'border-transparent hover:bg-slate-50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(team.id)}
                aria-current={active ? 'true' : undefined}
                className="w-full px-3 py-2 text-left"
              >
                <span
                  className={`block max-w-[12rem] truncate text-sm font-medium lg:max-w-none ${
                    active ? 'text-indigo-800' : 'text-slate-700'
                  }`}
                >
                  {team.name}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {team.memberCount} member{team.memberCount === 1 ? '' : 's'} &middot;{' '}
                  {team.openTaskCount} open
                </span>
              </button>

              {active ? (
                <div className="flex gap-1 border-t border-indigo-100 px-2 py-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-xs"
                    onClick={() => onOpenMembers(team)}
                  >
                    Members
                  </button>
                  {isOwner ? (
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => onDeleteTeam(team)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {teams.length === 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          No teams yet. Create one to start adding tasks.
        </p>
      ) : null}
    </aside>
  );
}
