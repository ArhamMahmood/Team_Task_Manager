export type User = {
  id: number;
  name: string;
  email: string;
  createdAt?: string;
};

export type Team = {
  id: number;
  name: string;
  description: string;
  createdBy: number;
  createdAt: string;
  memberCount: number;
  taskCount: number;
  openTaskCount: number;
};

export type TeamMember = {
  id: number;
  name: string;
  email: string;
  joinedAt: string;
  isOwner: boolean;
};

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type Task = {
  id: number;
  teamId: number;
  teamName: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignedTo: number | null;
  assigneeName: string | null;
  createdBy: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ValidationDetail = {
  path: string;
  message: string;
};
