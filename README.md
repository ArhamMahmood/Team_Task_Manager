# Team Task Manager

A full-stack team task manager: register, create teams, invite members, and manage tasks with
search and filters. Built for the Full Stack Development assessment.

![Dashboard](docs/screenshots/dashboard-desktop.png)

| Login | Mobile |
| --- | --- |
| ![Login](docs/screenshots/login-desktop.png) | ![Mobile](docs/screenshots/dashboard-mobile.png) |

## Features

| Requirement | Implementation |
| --- | --- |
| Register / login securely | `POST /api/auth/register`, `/login`, `/logout`, `GET /me` |
| Create and manage teams | `POST/GET/PATCH/DELETE /api/teams` |
| Add members to teams | `POST/DELETE /api/teams/:id/members`, invite by email |
| Create, assign, update, delete tasks | `/api/tasks` CRUD, assignee must be a team member |
| Filter by team or assignee | `GET /api/tasks?teamId=&assigneeId=&status=&q=` |
| Login / register forms | `AuthPage` with inline validation errors |
| Dashboard (team list, task list) | `Dashboard`, `TeamSidebar`, `TaskList` |
| Task modal (create / update) | `TaskModal` (single form for both) |
| Search and filter tasks | Debounced search, status and assignee filters |
| Responsive UI | Mobile-first Tailwind layout, verified at 390 px |
| PassportJS + Express Session | `passport-local`, `express-session` |
| Sessions in PostgreSQL | `connect-pg-simple`, with an in-memory fallback in dev |
| HTTP-only cookies | `httpOnly`, `sameSite=lax`, `secure` in production |
| Protect non-auth routes | `requireAuth` mounted on every router except auth |
| Validation | Joi schemas for bodies, params **and** query strings |
| No plain-text passwords | bcrypt, cost 12 |
| Due-date reminders | `GET /api/tasks/reminders` + `ReminderBanner` on the dashboard |
| Unprefixed routes from the brief | `/auth`, `/teams`, `/tasks` and `/users` mirror `/api/*` |

### Bonus features

| Bonus | Implementation |
| --- | --- |
| Role-based access | Only the team owner can edit/delete the team or manage members; task deletion is limited to the creator or team owner |
| Due-date reminders (login only) | The dashboard shows a dismissible banner for tasks assigned to you that are overdue or due today; clicking one opens the task modal |
| Invite by email (stubbed) | Owners invite an existing account by email; no SMTP or tokenised link is sent |

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS (no UI kit, no router, no state library)
- **Backend:** Node.js, Express 5, Passport (local strategy), Joi, `pg` (no ORM)
- **Database:** PostgreSQL 16 (Cloud SQL for PostgreSQL in production)
- **Deploy:** a single container on Google Cloud Run

## Architecture

```
Browser
  │  HTTPS, HTTP-only session cookie
  ▼
Cloud Run (one container, scale-to-zero)
  └── Express 5
      ├── /api/auth    passport-local + express-session + connect-pg-simple
      ├── /api/teams   teams, members, ownership checks
      ├── /api/tasks   tasks, assignment, filters, reminders
      └── /*           serves frontend/dist (React SPA)
            │
            └── Cloud SQL for PostgreSQL (sessions + application data)
```

The API and the SPA share one origin. That removes CORS entirely and lets the session cookie work
with `SameSite=Lax`, which is both simpler and safer than a token-in-localStorage setup.

## Project structure

```
backend/
  migrations/001_init.sql     idempotent schema, applied on boot
  src/
    app.js                    express app (exported, no listen)
    server.js                 listen + graceful shutdown
    config.js                 env parsing, fail-fast in production
    db.js                     pg pool, transactions
    session.js                pg session store / memory fallback
    passport.js               local strategy + serialize/deserialize
    middleware/               auth, validation, errors, origin check
    schemas/                  Joi schemas
    repos/                    parameterized SQL
    routes/                   auth, teams, tasks, users
  scripts/smoke.sh            end-to-end API smoke test
  test/                       38 integration tests (node:test + supertest)
frontend/
  src/api/                    typed fetch client + shared types
  src/auth/AuthContext.tsx    session bootstrap, login/register/logout
  src/components/             AuthPage, Dashboard, TaskModal, TeamModal, MembersModal, ReminderBanner, ...
Dockerfile                    multi-stage build, distroless runtime
docker-compose.yml            local PostgreSQL
.github/workflows/ci.yml      tests + frontend build on every PR
```

## Demo account

Run `npm run seed` in `backend/` once to create a demo team with tasks and two accounts:

| Role | Email | Password |
| --- | --- | --- |
| Team owner | `demo@example.com` | `password123` |
| Team member | `mia@example.com` | `password123` |

The seed is idempotent, so it is safe to run again.

## Local setup

**Prerequisites:** Node.js 20+ and Docker.

```bash
# 1. Database
docker compose up -d

# 2. Backend (terminal 1)
cd backend
cp .env.example .env
npm ci
npm run seed           # optional: demo team + accounts
npm run dev            # http://localhost:3000

# 3. Frontend (terminal 2)
cd frontend
npm ci
npm run dev            # http://localhost:5173
```

Open <http://localhost:5173> and create an account. Vite proxies `/api` to port 3000, so the
browser only ever talks to one origin.

Run the tests:

```bash
cd backend && npm test          # 38 integration tests against team_task_test
cd frontend && npm run build    # typecheck + production build
```

## Environment variables

| Variable | Default (dev) | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` requires `SESSION_SECRET` and either `DATABASE_URL` or the Cloud SQL variables |
| `PORT` | `3000` | Cloud Run injects `8080` |
| `DATABASE_URL` | local Docker Postgres | TCP connection string for local, CI or any hosted Postgres |
| `INSTANCE_CONNECTION_NAME` | – | `project:region:instance`; when set, the app connects through `/cloudsql/<instance>` |
| `DB_USER` | – | Database user for the Cloud SQL socket connection |
| `DB_PASSWORD` | – | Database password (prefer a Secret Manager reference) |
| `DB_NAME` | – | Database name, e.g. `team_task` |
| `SESSION_SECRET` | dev-only value | Required in production |
| `SESSION_TTL_DAYS` | `7` | Cookie and session lifetime |
| `COOKIE_SECURE` | `true` in production | Set to `false` only for local HTTP tests |
| `BCRYPT_ROUNDS` | `12` (`4` in tests) | |
| `AUTH_RATE_LIMIT_MAX` | `20` per 15 min | Applies to login and register |
| `VITE_API_URL` | `/api` | Only needed if the API lives on another origin |

## API reference

All non-auth routes require a valid session cookie. Errors always look like
`{ "error": { "message", "code", "details?" } }`.

Every path below is also served **without** the `/api` prefix (`/auth/...`, `/teams/...`,
`/tasks/...`, `/users/...`) to match the route names in the brief.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | public | Create an account and start a session |
| `POST` | `/api/auth/login` | public | Sign in |
| `POST` | `/api/auth/logout` | session | Destroy the session |
| `GET` | `/api/auth/me` | session | Current user |
| `GET` | `/api/teams` | session | Teams you belong to, with counts |
| `POST` | `/api/teams` | session | Create a team (you become owner) |
| `GET` | `/api/teams/:id` | member | Team details |
| `PATCH` | `/api/teams/:id` | owner | Rename / change description |
| `DELETE` | `/api/teams/:id` | owner | Delete team, tasks and memberships |
| `GET` | `/api/teams/:id/members` | member | Member list |
| `POST` | `/api/teams/:id/members` | owner | Add a member by email |
| `DELETE` | `/api/teams/:id/members/:userId` | owner | Remove a member |
| `GET` | `/api/tasks` | session | Filter by `teamId`, `assigneeId`, `status`, `q`, `limit` |
| `POST` | `/api/tasks` | member | Create and optionally assign a task |
| `GET` | `/api/tasks/reminders` | session | Open tasks assigned to you that are overdue or due today |
| `GET` | `/api/tasks/:id` | member | Task details |
| `PATCH` | `/api/tasks/:id` | member | Update title, description, status, assignee, due date |
| `DELETE` | `/api/tasks/:id` | creator or owner | Delete a task |
| `GET` | `/api/users?search=` | session | Find users by name or email (for invites) |
| `GET` | `/api/health` | public | Liveness + database check |

Example:

```bash
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"password123"}' \
  http://localhost:3000/api/auth/register

curl -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Website Redesign"}' http://localhost:3000/api/teams

curl -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"teamId":1,"title":"Design homepage","status":"in_progress"}' \
  http://localhost:3000/api/tasks
```

## Security

- **Passwords:** bcrypt cost 12; inputs longer than 72 bytes are rejected rather than truncated.
- **Sessions:** stored in PostgreSQL, id regenerated on login (session fixation), destroyed on logout.
- **Cookies:** `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- **Authorization:** every non-auth router is behind `requireAuth`; team and task access is checked
  against membership, and destructive actions against ownership.
- **Input handling:** Joi validation on body, params and query with `stripUnknown`; all SQL is
  parameterized; request bodies are capped at 10 kB.
- **Transport:** Helmet with a strict CSP, HSTS, `nosniff` and `SAMEORIGIN` framing.
- **Abuse:** rate limiting on login and register; state-changing requests with a foreign `Origin`
  are rejected.
- **Secrets:** `.env` is git-ignored; production values are injected by Cloud Run.

## Testing

Three layers, all run locally before deploying:

1. **Integration tests** — 38 tests (`node:test` + `supertest`) against a real Postgres:
   auth and session lifecycle, hashing, duplicate emails, validation, team membership,
   creator-only actions, task filters/search, cross-team isolation, cascade deletes,
   route aliases and due-date reminders.
2. **API smoke test** — `backend/scripts/smoke.sh` exercises the full flow with `curl`
   (20 checks, including the aliases, reminders, CSRF origin check and logout invalidation).
3. **Browser E2E** — Playwright: register, create team, create/edit/filter/delete tasks,
   reminder banner, invite a member, verify a non-owner cannot delete the team or manage
   members, sign out/in. 47 checks, zero console errors, verified at desktop and 390 px mobile.

## Production build

```bash
docker build -t team-task-manager .
docker run --rm -p 8080:8080 --network host \
  -e NODE_ENV=production \
  -e COOKIE_SECURE=false \
  -e SESSION_SECRET=local-test-secret \
  -e DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/team_task \
  team-task-manager
```

The image is a multi-stage build with a distroless Node 22 runtime (no shell, no package manager,
non-root user) and comes in at ~219 MB. Migrations run automatically on boot.

## Deployment (Cloud SQL + Cloud Run)

The brief requires a database service on Google Cloud Platform, so production uses
**Cloud SQL for PostgreSQL**. Cloud Run connects through its built-in Cloud SQL connector
(a Unix socket), so no proxy or VPC connector runs inside the container.

### 1. Create the database

```bash
export PROJECT_ID=your-project-id
export REGION=us-central1
export INSTANCE=team-task-db

gcloud services enable sqladmin.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud sql instances create "$INSTANCE" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-size=10GB \
  --storage-auto-increase

gcloud sql databases create team_task --instance="$INSTANCE"

DB_PASSWORD="$(openssl rand -base64 24)"
gcloud sql users create app --instance="$INSTANCE" --password="$DB_PASSWORD"
```

### 2. Store the secrets

```bash
printf '%s' "$DB_PASSWORD" | gcloud secrets create db-password --data-file=-
openssl rand -base64 48 | gcloud secrets create session-secret --data-file=-

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
for secret in db-password session-secret; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done
```

### 3. Deploy

```bash
gcloud run deploy team-task-manager \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 2 \
  --min-instances 0 \
  --add-cloudsql-instances "$PROJECT_ID:$REGION:$INSTANCE" \
  --set-env-vars "NODE_ENV=production,INSTANCE_CONNECTION_NAME=$PROJECT_ID:$REGION:$INSTANCE,DB_NAME=team_task,DB_USER=app" \
  --set-secrets "DB_PASSWORD=db-password:latest,SESSION_SECRET=session-secret:latest"
```

Migrations run automatically on the first boot.

### 4. Seed the demo data

Cloud Run has no shell, so run the seed through the Cloud SQL Auth Proxy from your machine:

```bash
# terminal 1
cloud-sql-proxy "$PROJECT_ID:$REGION:$INSTANCE" --port 5433

# terminal 2
cd backend
DATABASE_URL="postgres://app:$DB_PASSWORD@127.0.0.1:5433/team_task" npm run seed
```

### 5. Verify

```bash
cd backend && ./scripts/smoke.sh https://YOUR-SERVICE-URL
```

### Cost

Cloud Run, Cloud Build and Artifact Registry stay within their always-free allowances at demo
traffic. Cloud SQL has **no permanent free tier**: `db-f1-micro` with 10 GB costs roughly
**$9–10/month**, covered by the $300 / 90-day trial credit. Stop or delete the instance when
you are finished:

```bash
gcloud sql instances patch "$INSTANCE" --activation-policy=NEVER   # stop
gcloud sql instances delete "$INSTANCE"                            # remove
```

Notes:

- Leave `COOKIE_SECURE` unset on Cloud Run (it is HTTPS); set it to `false` only for local HTTP.
- `DATABASE_URL` and the `INSTANCE_CONNECTION_NAME` path are mutually exclusive; the socket
  configuration wins when both are present.
- Cloud Run scales to zero, so there is no idle compute cost. `--max-instances 2` caps spending.

## Design decisions

- **One deployable service.** Serving the SPA from Express keeps the API and UI same-origin, which
  removes CORS and cross-site cookie problems and halves the number of moving parts to deploy.
- **No ORM.** A small repository layer with parameterized SQL is easier to review, lighter at
  runtime and faster to cold-start than Prisma or Sequelize.
- **No frontend framework extras.** Two dependencies (`react`, `react-dom`), state-based navigation
  instead of a router, and a typed `fetch` wrapper instead of axios. The bundle is ~76 kB gzipped.
- **Server-enforced permissions.** The UI hides actions a user cannot perform, but every rule is
  enforced again in the API.

## Limitations

- Email invites only work for accounts that already exist; no SMTP or tokenised invitation link
  is sent.
- Reminders are evaluated when the dashboard loads; there is no background job or email digest.
- Single region; no offline support.
