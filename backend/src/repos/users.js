import { query } from '../db.js';

const mapUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  createdAt: row.created_at,
});

export async function createUser({ name, email, passwordHash }) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [name, email, passwordHash],
  );
  return mapUser(rows[0]);
}

/** Internal only: includes the password hash for Passport verification. */
export async function findUserByEmail(email) {
  const { rows } = await query(
    `SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1`,
    [email],
  );
  if (!rows[0]) return null;

  return { ...mapUser(rows[0]), passwordHash: rows[0].password_hash };
}

/** Used by Passport's deserializeUser - never exposes the hash. */
export async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, name, email, created_at FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function searchUsers(term, excludeUserId, limit = 10) {
  const { rows } = await query(
    `SELECT id, name, email, created_at
       FROM users
      WHERE id <> $1
        AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR email::text ILIKE '%' || $2 || '%')
      ORDER BY name ASC
      LIMIT $3`,
    [excludeUserId, term ?? '', limit],
  );
  return rows.map(mapUser);
}
