-- RPC para trabalhadora salvar checklist do serviço de forma segura
CREATE OR REPLACE FUNCTION rpc_save_checklist(p_id UUID, p_checklist JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE servicos
  SET checklist = p_checklist
  WHERE id = p_id
    AND trabalhadora_id = get_trabalhadora_id();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION rpc_save_checklist(UUID, JSONB) TO authenticated;
