import Joi from 'joi';

const email = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .max(254);

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: email.required(),
  // bcrypt only uses the first 72 bytes, so reject longer passwords instead of
  // silently truncating them.
  password: Joi.string().min(8).max(72).required(),
});

export const loginSchema = Joi.object({
  email: email.required(),
  password: Joi.string().min(1).max(72).required(),
});
