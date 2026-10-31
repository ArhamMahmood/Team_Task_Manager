-- Runs once, when the Postgres volume is first created.
-- The app database (team_task) is created by POSTGRES_DB; this adds the test database.
SELECT 'CREATE DATABASE team_task_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'team_task_test')\gexec
