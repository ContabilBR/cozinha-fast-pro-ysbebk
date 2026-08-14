INSERT INTO usuarios (id, nome, email, senha_hash, role, restaurante_id, created_at)
SELECT
  gen_random_uuid(),
  u.name,
  u.email,
  a.password,
  COALESCE(p.role, u.role, 'garcom'),
  p.restaurante_id,
  u.created_at
FROM "user" u
JOIN account a ON a.user_id = u.id AND a.provider_id = 'credential'
LEFT JOIN profiles p ON p.user_id = u.id
WHERE p.restaurante_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM usuarios us WHERE us.email = u.email);
