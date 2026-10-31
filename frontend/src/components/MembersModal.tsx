import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import type { Team, TeamMember } from '../api/types';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

type Props = {
  open: boolean;
  team: Team | null;
  currentUserId: number;
  onClose: () => void;
  onChanged: () => void;
};

export function MembersModal({ open, team, currentUserId, onClose, onChanged }: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (teamId: number) => {
    setLoading(true);
    try {
      const data = await api.get<{ members: TeamMember[] }>(`/teams/${teamId}/members`);
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !team) return;
    setEmail('');
    setError(null);
    void load(team.id);
  }, [open, team, load]);

  if (!team) return null;

  const isOwner = team.createdBy === currentUserId;

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!team) return;

    setBusy(true);
    setError(null);
    try {
      await api.post(`/teams/${team.id}/members`, { email: email.trim() });
      setEmail('');
      await load(team.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add that member.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: TeamMember) {
    if (!team) return;
    if (!window.confirm(`Remove ${member.name} from ${team.name}?`)) return;

    setBusy(true);
    setError(null);
    try {
      await api.delete(`/teams/${team.id}/members/${member.id}`);
      await load(team.id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove that member.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title={`${team.name} - members`} onClose={onClose}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {member.name}
                  {member.isOwner ? (
                    <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                      Owner
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-slate-500">{member.email}</p>
              </div>

              {isOwner && !member.isOwner ? (
                <button
                  type="button"
                  className="btn btn-ghost shrink-0 px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => removeMember(member)}
                  disabled={busy}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isOwner ? (
        <form className="mt-4 border-t border-slate-100 pt-4" onSubmit={addMember}>
          <label className="label" htmlFor="member-email">
            Invite by email
          </label>
          <div className="flex gap-2">
            <input
              id="member-email"
              type="email"
              className="input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              required
            />
            <button type="submit" className="btn btn-primary shrink-0" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4 text-white" /> : null}
              Add
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            The person must already have an account.
          </p>
        </form>
      ) : (
        <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
          Only the team owner can manage members.
        </p>
      )}
    </Modal>
  );
}
