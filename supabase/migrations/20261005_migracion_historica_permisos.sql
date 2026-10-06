-- Restringe las RPC de migración histórica exclusivamente al service_role.
-- Estas funciones escriben/eliminan datos con SECURITY DEFINER y no deben
-- quedar disponibles desde clientes normales de PGL.

REVOKE ALL ON FUNCTION public.importar_operacion_historica(
  bigint,
  text,
  integer,
  jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.importar_operacion_historica(
  bigint,
  text,
  integer,
  jsonb
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.importar_operacion_historica(
  bigint,
  text,
  integer,
  jsonb
) TO service_role;


REVOKE ALL ON FUNCTION public.revertir_lote_migracion_historica(
  bigint
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.revertir_lote_migracion_historica(
  bigint
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.revertir_lote_migracion_historica(
  bigint
) TO service_role;
