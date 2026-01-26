-- RPCs for admin to manage trabalhadoras safely
-- This avoids RLS timeout issues when inserting/updating

CREATE OR REPLACE FUNCTION rpc_create_trabalhadora(
  p_nome TEXT,
  p_user_id UUID DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_tipos_de_servico TEXT[] DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_valor_pagamento NUMERIC DEFAULT NULL,
  p_dias_disponiveis TEXT[] DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem criar trabalhadoras';
  END IF;

  INSERT INTO trabalhadoras (
    nome, user_id, telefone, tipos_de_servico, tipo_pagamento,
    valor_pagamento, dias_disponiveis, observacoes, ativo
  ) VALUES (
    p_nome, p_user_id, p_telefone, p_tipos_de_servico, p_tipo_pagamento,
    p_valor_pagamento, p_dias_disponiveis, p_observacoes, p_ativo
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION rpc_update_trabalhadora(
  p_id UUID,
  p_nome TEXT,
  p_user_id UUID DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_tipos_de_servico TEXT[] DEFAULT NULL,
  p_tipo_pagamento TEXT DEFAULT NULL,
  p_valor_pagamento NUMERIC DEFAULT NULL,
  p_dias_disponiveis TEXT[] DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_ativo BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem atualizar trabalhadoras';
  END IF;

  UPDATE trabalhadoras SET
    nome = p_nome,
    user_id = p_user_id,
    telefone = p_telefone,
    tipos_de_servico = p_tipos_de_servico,
    tipo_pagamento = p_tipo_pagamento,
    valor_pagamento = p_valor_pagamento,
    dias_disponiveis = p_dias_disponiveis,
    observacoes = p_observacoes,
    ativo = p_ativo
  WHERE id = p_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION rpc_delete_trabalhadora(p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir trabalhadoras';
  END IF;

  DELETE FROM trabalhadoras WHERE id = p_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION rpc_create_trabalhadora(TEXT, UUID, TEXT, TEXT[], TEXT, NUMERIC, TEXT[], TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_trabalhadora(UUID, TEXT, UUID, TEXT, TEXT[], TEXT, NUMERIC, TEXT[], TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_trabalhadora(UUID) TO authenticated;
