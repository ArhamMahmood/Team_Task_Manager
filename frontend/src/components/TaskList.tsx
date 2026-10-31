import type { Task, TaskStatus } from '../api/types';

const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: 'To do', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  in_progress: { label: 'In progress', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  done: { label: 'Done', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

type Props = {
  tasks: Task[];
  loading: boolean;
  showTeamName: boolean;
  canDelete: (task: Task) => boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function TaskList({ tasks, loading, showTeamName, canDelete, onEdit, onDelete }: Props) {
  if (loading) {
    return (
      <ul className="grid gap-3 xl:grid-cols-2" aria-busy="true" aria-label="Loading tasks">
        {[0, 1, 2, 3].map((index) => (
          <li key={index} className="card animate-pulse p-4">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full rounded bg-slate-100" />
            <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
          </li>
        ))}
      </ul>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <svg viewBox="0 0 20 20" className="h-6 w-6" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4zm3 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 7 7zm0 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 7 10zm.75 2.25a.75.75 0 0 0 0 1.5h2.5a.75.75 0 0 0 0-1.5h-2.5z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <h3 className="mt-3 text-sm font-semibold text-slate-800">No tasks found</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Adjust your filters, or create a task to get things moving.
        </p>
      </div>
    );
  }

  const currentDay = today();

  return (
    <ul className="grid gap-3 xl:grid-cols-2">
      {tasks.map((task) => {
        const status = STATUS_META[task.status];
        const overdue = task.dueDate !== null && task.status !== 'done' && task.dueDate < currentDay;

        return (
          <li key={task.id} className="card flex flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold leading-6 text-slate-900">{task.title}</h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}
              >
                {status.label}
              </span>
            </div>

            {task.description ? (
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">{task.description}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              {showTeamName ? (
                <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                  {task.teamName}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                  <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 15a6.5 6.5 0 0 1 13 0 .75.75 0 0 1-.75.75h-11.5A.75.75 0 0 1 3.5 15z" />
                </svg>
                {task.assigneeName ?? 'Unassigned'}
              </span>
              {task.dueDate ? (
                <span className={overdue ? 'font-medium text-red-600' : ''}>
                  Due {formatDate(task.dueDate)}
                  {overdue ? ' (overdue)' : ''}
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-2">
              <button
                type="button"
                className="btn btn-ghost px-2 py-1 text-xs"
                onClick={() => onEdit(task)}
              >
                Edit
              </button>
              {canDelete(task) ? (
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onDelete(task)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
