-- Backfill: copy legacy garcons (and any other pre-2026-04-17 role accounts)
-- from the Better Auth "user"/"account" tables into "usuarios", so they show
-- up consistently in every screen that reads from "usuarios" (e.g. Equipe).
-- Safe to run more than once: uses NOT EXISTS, never overwrites a password.
--
-- Note: garcons.ts never writes to "profiles", so we can't rely on it for
-- restaurante_id here. Falls back to the oldest restaurante on record,
-- matching the same fallback pattern used in 20260429000001_backfill_restaurante_id.sql.
INSERT INTO usuarios (id, nome, email, senha_hash, role, restaurante_id, created_at)
SELECT
  gen_random_uuid(),
  u.name,
  u.email,
  a.password,
  COALESCE(p.role, u.role, 'garcom'),
  COALESCE(p.restaurante_id, (SELECT id FROM restaurante ORDER BY created_at ASC LIMIT 1)),
  u.created_at
FROM "user" u
JOIN account a ON a.user_id = u.id AND a.provider_id = 'credential'
LEFT JOIN profiles p ON p.user_id = u.id
WHERE NOT EXISTS (SELECT 1 FROM usuarios us WHERE us.email = u.email)
  AND EXISTS (SELECT 1 FROM restaurante);
