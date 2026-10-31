import type { TaskStatus } from '../api/types';

export type Filters = {
  q: string;
  status: TaskStatus | 'all';
  assigneeId: string;
};

type Assignee = { id: number; name: string };

type Props = {
  filters: Filters;
  assignees: Assignee[];
  canCreateTask: boolean;
  onChange: (filters: Filters) => void;
  onNewTask: () => void;
};

export function FilterBar({ filters, assignees, canCreateTask, onChange, onNewTask }: Props) {
  return (
    <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative sm:min-w-[14rem] sm:flex-1">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 1 0 3.4 9.8l3.4 3.4a.75.75 0 1 0 1.06-1.06l-3.4-3.4A5.5 5.5 0 0 0 9 3.5zM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0z"
            clipRule="evenodd"
          />
        </svg>
        <input
          className="input pl-9"
          placeholder="Search tasks..."
          aria-label="Search tasks"
          value={filters.q}
          onChange={(event) => onChange({ ...filters, q: event.target.value })}
        />
      </div>

      <select
        className="input sm:w-40"
        aria-label="Filter by status"
        value={filters.status}
        onChange={(event) =>
          onChange({ ...filters, status: event.target.value as Filters['status'] })
        }
      >
        <option value="all">All statuses</option>
        <option value="todo">To do</option>
        <option value="in_progress">In progress</option>
        <option value="done">Done</option>
      </select>

      <select
        className="input sm:w-44"
        aria-label="Filter by assignee"
        value={filters.assigneeId}
        onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}
      >
        <option value="all">Anyone</option>
        {assignees.map((assignee) => (
          <option key={assignee.id} value={assignee.id}>
            {assignee.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn btn-primary sm:ml-auto"
        onClick={onNewTask}
        disabled={!canCreateTask}
        title={canCreateTask ? undefined : 'Create a team first'}
      >
        + New task
      </button>
    </div>
  );
}
