-- Permiso individual para cargar nuevas ventas con origen BOT IA LC.
-- Se inicializa deshabilitado para todos los perfiles existentes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS puede_origen_bot_ia_lc boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.puede_origen_bot_ia_lc IS
  'Permite a un usuario L1 registrar nuevas ventas con origen BOT IA LC; no afecta operaciones historicas.';
