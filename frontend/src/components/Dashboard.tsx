import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Reminders, Task, Team, TeamMember } from '../api/types';
import { FilterBar, type Filters } from './FilterBar';
import { MembersModal } from './MembersModal';
import { ReminderBanner } from './ReminderBanner';
import { TaskList } from './TaskList';
import { TaskModal } from './TaskModal';
import { TeamModal } from './TeamModal';
import { TeamSidebar } from './TeamSidebar';

const INITIAL_FILTERS: Filters = { q: '', status: 'all', assigneeId: 'all' };

export function Dashboard() {
  const { user, logout } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [reminders, setReminders] = useState<Reminders | null>(null);
  const [remindersDismissed, setRemindersDismissed] = useState(false);

  const [taskModal, setTaskModal] = useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null,
  });
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [membersTeam, setMembersTeam] = useState<Team | null>(null);

  const currentUserId = user?.id ?? 0;
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const refresh = () => setRefreshToken((value) => value + 1);

  // Debounce the search box so typing does not spam the API.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(filters.q.trim()), 300);
    return () => clearTimeout(timer);
  }, [filters.q]);

  useEffect(() => {
    let active = true;
    setTeamsLoading(true);

    api
      .get<{ teams: Team[] }>('/teams')
      .then((data) => {
        if (active) setTeams(data.teams);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Could not load teams.');
      })
      .finally(() => {
        if (active) setTeamsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshToken]);

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      return;
    }

    let active = true;
    api
      .get<{ members: TeamMember[] }>(`/teams/${selectedTeamId}/members`)
      .then((data) => {
        if (active) setMembers(data.members);
      })
      .catch(() => {
        if (active) setMembers([]);
      });

    return () => {
      active = false;
    };
  }, [selectedTeamId, refreshToken]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();

    if (selectedTeamId) params.set('teamId', String(selectedTeamId));
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.assigneeId !== 'all') params.set('assigneeId', filters.assigneeId);

    setTasksLoading(true);
    api
      .get<{ tasks: Task[] }>(`/tasks?${params.toString()}`)
      .then((data) => {
        if (active) setTasks(data.tasks);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : 'Could not load tasks.');
      })
      .finally(() => {
        if (active) setTasksLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedTeamId, debouncedQuery, filters.status, filters.assigneeId, refreshToken]);

  // Due-date reminders are fetched on load and after every refresh.
  useEffect(() => {
    let active = true;

    api
      .get<Reminders>('/tasks/reminders')
      .then((data) => {
        if (active) setReminders(data);
      })
      .catch(() => {
        // Reminders are a convenience; never block the dashboard on them.
        if (active) setReminders(null);
      });

    return () => {
      active = false;
    };
  }, [refreshToken]);

  // Reset the assignee filter whenever the visible team changes.
  useEffect(() => {
    setFilters((current) => ({ ...current, assigneeId: 'all' }));
  }, [selectedTeamId]);

  const assignees = useMemo(() => {
    if (selectedTeam) return members.map((member) => ({ id: member.id, name: member.name }));

    const unique = new Map<number, string>();
    for (const task of tasks) {
      if (task.assignedTo !== null) {
        unique.set(task.assignedTo, task.assigneeName ?? `User #${task.assignedTo}`);
      }
    }
    return [...unique.entries()].map(([id, name]) => ({ id, name }));
  }, [selectedTeam, members, tasks]);

  const canDeleteTask = (task: Task) => {
    if (task.createdBy === currentUserId) return true;
    const team = teams.find((candidate) => candidate.id === task.teamId);
    return team?.createdBy === currentUserId;
  };

  function handleSelectTeam(teamId: number | null) {
    setSelectedTeamId(teamId);
    setError(null);
  }

  async function handleDeleteTeam(team: Team) {
    if (!window.confirm(`Delete "${team.name}" and all of its tasks? This cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/teams/${team.id}`);
      if (selectedTeamId === team.id) setSelectedTeamId(null);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the team.');
    }
  }

  async function handleDeleteTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;

    try {
      await api.delete(`/tasks/${task.id}`);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete the task.');
    }
  }

  function handleTeamCreated(team: Team) {
    setSelectedTeamId(team.id);
    refresh();
  }

  const initials =
    user?.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') ?? '?';

  const newTaskTeamId = selectedTeamId ?? teams[0]?.id ?? null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0z" />
              </svg>
            </span>
            <span className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">
              Team Task Manager
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700"
              aria-hidden="true"
            >
              {initials}
            </span>
            <button type="button" className="btn btn-secondary px-3 py-1.5" onClick={() => void logout()}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <TeamSidebar
            teams={teams}
            selectedTeamId={selectedTeamId}
            currentUserId={currentUserId}
            onSelect={handleSelectTeam}
            onCreate={() => setTeamModalOpen(true)}
            onOpenMembers={(team) => setMembersTeam(team)}
            onDeleteTeam={(team) => void handleDeleteTeam(team)}
          />

          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {selectedTeam ? selectedTeam.name : 'All tasks'}
                </h1>
                <p className="text-sm text-slate-500">
                  {selectedTeam
                    ? selectedTeam.description || 'No description yet.'
                    : `${teams.length} team${teams.length === 1 ? '' : 's'} in your workspace`}
                </p>
              </div>
              {selectedTeam ? (
                <p className="text-xs text-slate-500">
                  {selectedTeam.taskCount} task{selectedTeam.taskCount === 1 ? '' : 's'} &middot;{' '}
                  {selectedTeam.openTaskCount} open
                </p>
              ) : null}
            </div>

            <FilterBar
              filters={filters}
              assignees={assignees}
              canCreateTask={teams.length > 0}
              onChange={setFilters}
              onNewTask={() => setTaskModal({ open: true, task: null })}
            />

            {reminders && !remindersDismissed ? (
              <ReminderBanner
                overdue={reminders.overdue}
                dueToday={reminders.dueToday}
                onOpenTask={(task) => setTaskModal({ open: true, task })}
                onDismiss={() => setRemindersDismissed(true)}
              />
            ) : null}

            {error ? (
              <div
                className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                <span>{error}</span>
                <button
                  type="button"
                  className="shrink-0 font-medium underline-offset-2 hover:underline"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </button>
              </div>
            ) : null}

            {!teamsLoading && teams.length === 0 ? (
              <div className="card mt-4 flex flex-col items-center px-6 py-12 text-center">
                <h2 className="text-base font-semibold text-slate-900">Create your first team</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Teams hold your tasks and members. You can invite teammates once a team exists.
                </p>
                <button
                  type="button"
                  className="btn btn-primary mt-4"
                  onClick={() => setTeamModalOpen(true)}
                >
                  + New team
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <TaskList
                  tasks={tasks}
                  loading={tasksLoading}
                  showTeamName={selectedTeamId === null}
                  canDelete={canDeleteTask}
                  onEdit={(task) => setTaskModal({ open: true, task })}
                  onDelete={(task) => void handleDeleteTask(task)}
                />
              </div>
            )}
          </section>
        </div>
      </main>

      <TaskModal
        open={taskModal.open}
        task={taskModal.task}
        teams={teams}
        defaultTeamId={newTaskTeamId}
        onClose={() => setTaskModal({ open: false, task: null })}
        onSaved={refresh}
      />

      <TeamModal
        open={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
        onCreated={handleTeamCreated}
      />

      <MembersModal
        open={membersTeam !== null}
        team={membersTeam}
        currentUserId={currentUserId}
        onClose={() => setMembersTeam(null)}
        onChanged={refresh}
      />
    </div>
  );
}
