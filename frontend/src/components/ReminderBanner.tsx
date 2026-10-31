import type { Task } from '../api/types';

type Props = {
  overdue: Task[];
  dueToday: Task[];
  onOpenTask: (task: Task) => void;
  onDismiss: () => void;
};

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function ReminderBanner({ overdue, dueToday, onOpenTask, onDismiss }: Props) {
  const count = overdue.length + dueToday.length;
  if (count === 0) return null;

  // Show the most urgent tasks first, but keep the banner compact.
  const items = [
    ...overdue.map((task) => ({ task, isOverdue: true })),
    ...dueToday.map((task) => ({ task, isOverdue: false })),
  ].slice(0, 3);

  const hasOverdue = overdue.length > 0;

  return (
    <div
      role="status"
      aria-label="Task due date reminders"
      className={`mt-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        hasOverdue
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      <div className="min-w-0">
        <p className="font-semibold">
          {count} task{count === 1 ? '' : 's'} need{count === 1 ? 's' : ''} attention
        </p>
        <ul className="mt-1 space-y-0.5">
          {items.map(({ task, isOverdue }) => (
            <li key={task.id} className="flex flex-wrap items-baseline gap-x-2">
              <button
                type="button"
                className="truncate text-left font-medium underline-offset-2 hover:underline"
                onClick={() => onOpenTask(task)}
              >
                {task.title}
              </button>
              <span className="text-xs opacity-80">
                {isOverdue ? `overdue since ${formatDate(task.dueDate!)}` : 'due today'}
              </span>
            </li>
          ))}
        </ul>
        {count > items.length ? (
          <p className="mt-1 text-xs opacity-80">and {count - items.length} more</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
        aria-label="Dismiss reminders"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}
