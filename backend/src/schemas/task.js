import Joi from 'joi';

export const TASK_STATUSES = ['todo', 'in_progress', 'done'];

const taskFields = {
  title: Joi.string().trim().min(2).max(200),
  description: Joi.string().trim().max(2000).allow('', null),
  status: Joi.string().valid(...TASK_STATUSES),
  assignedTo: Joi.number().integer().min(1).allow(null),
  dueDate: Joi.date().iso().allow(null),
};

export const createTaskSchema = Joi.object({
  ...taskFields,
  title: taskFields.title.required(),
  teamId: Joi.number().integer().min(1).required(),
  status: taskFields.status.default('todo'),
  assignedTo: taskFields.assignedTo.default(null),
  dueDate: taskFields.dueDate.default(null),
});

export const updateTaskSchema = Joi.object(taskFields).min(1);

export const taskQuerySchema = Joi.object({
  teamId: Joi.number().integer().min(1),
  assigneeId: Joi.number().integer().min(1),
  status: Joi.string().valid(...TASK_STATUSES),
  q: Joi.string().trim().max(100).allow(''),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

export const taskIdParam = Joi.object({ id: Joi.number().integer().min(1).required() });
