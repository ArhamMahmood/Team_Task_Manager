import Joi from 'joi';

const id = Joi.number().integer().min(1);

export const teamIdParam = Joi.object({ id: id.required() });

export const teamMemberParam = Joi.object({
  id: id.required(),
  userId: id.required(),
});

export const createTeamSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(500).allow('', null).default(''),
});

export const updateTeamSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(500).allow('', null),
}).min(1);

export const addMemberSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254)
    .required(),
});
