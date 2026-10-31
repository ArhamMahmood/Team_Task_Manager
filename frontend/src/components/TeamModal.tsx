import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api/client';
import type { Team } from '../api/types';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (team: Team) => void;
};

export function TeamModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setError(null);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const data = await api.post<{ team: Team }>('/teams', {
        name: name.trim(),
        description: description.trim(),
      });
      onCreated(data.team);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the team.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Create a team"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="team-form" className="btn btn-primary" disabled={submitting}>
            {submitting ? <Spinner className="h-4 w-4 text-white" /> : null}
            Create team
          </button>
        </>
      }
    >
      <form id="team-form" className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="team-name">
            Team name
          </label>
          <input
            id="team-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={100}
            placeholder="e.g. Website redesign"
            autoFocus
          />
        </div>

        <div>
          <label className="label" htmlFor="team-description">
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="team-description"
            className="input min-h-[80px] resize-y"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            placeholder="What is this team working on?"
          />
        </div>
      </form>
    </Modal>
  );
}
