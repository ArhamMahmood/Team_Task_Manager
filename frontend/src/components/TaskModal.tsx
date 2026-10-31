import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import type { Task, TaskStatus, Team, TeamMember } from '../api/types';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

type Props = {
  open: boolean;
  task: Task | null;
  teams: Team[];
  defaultTeamId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

type FormState = {
  title: string;
  description: string;
  status: TaskStatus;
  assignedTo: string;
  dueDate: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  status: 'todo',
  assignedTo: '',
  dueDate: '',
};

export function TaskModal({ open, task, teams, defaultTeamId, onClose, onSaved }: Props) {
  const [teamId, setTeamId] = useState<number | null>(defaultTeamId);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    if (task) {
      setTeamId(task.teamId);
      setForm({
        title: task.title,
        description: task.description,
        status: task.status,
        assignedTo: task.assignedTo === null ? '' : String(task.assignedTo),
        dueDate: task.dueDate ?? '',
      });
    } else {
      setTeamId(defaultTeamId);
      setForm(EMPTY_FORM);
    }
  }, [open, task, defaultTeamId]);

  useEffect(() => {
    if (!open || !teamId) {
      setMembers([]);
      return;
    }

    let active = true;
    setLoadingMembers(true);

    api
      .get<{ members: TeamMember[] }>(`/teams/${teamId}/members`)
      .then((data) => {
        if (active) setMembers(data.members);
      })
      .catch(() => {
        if (active) setMembers([]);
      })
      .finally(() => {
        if (active) setLoadingMembers(false);
      });

    return () => {
      active = false;
    };
  }, [open, teamId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamId) {
      setError('Choose a team for this task.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      assignedTo: form.assignedTo === '' ? null : Number(form.assignedTo),
      dueDate: form.dueDate === '' ? null : form.dueDate,
    };

    try {
      if (task) {
        await api.patch(`/tasks/${task.id}`, payload);
      } else {
        await api.post('/tasks', { ...payload, teamId });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the task.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="task-form"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? <Spinner className="h-4 w-4 text-white" /> : null}
            {task ? 'Save changes' : 'Create task'}
          </button>
        </>
      }
    >
      <form id="task-form" className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="task-title">
            Title
          </label>
          <input
            id="task-title"
            className="input"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            required
            minLength={2}
            maxLength={200}
            placeholder="What needs to be done?"
            autoFocus
          />
        </div>

        <div>
          <label className="label" htmlFor="task-description">
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="task-description"
            className="input min-h-[84px] resize-y"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            maxLength={2000}
            placeholder="Add some context..."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="task-team">
              Team
            </label>
            <select
              id="task-team"
              className="input"
              value={teamId ?? ''}
              onChange={(event) => setTeamId(Number(event.target.value))}
              disabled={Boolean(task)}
              required
            >
              <option value="" disabled>
                Select a team
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="task-status">
              Status
            </label>
            <select
              id="task-status"
              className="input"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as TaskStatus })
              }
            >
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="task-assignee">
              Assignee
            </label>
            <select
              id="task-assignee"
              className="input"
              value={form.assignedTo}
              onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
              disabled={loadingMembers || !teamId}
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="task-due-date">
              Due date
            </label>
            <input
              id="task-due-date"
              type="date"
              className="input"
              value={form.dueDate}
              onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
