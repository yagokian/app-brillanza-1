-- Admin-only RPCs for servicos CRUD

CREATE OR REPLACE FUNCTION rpc_admin_create_servico(
  p_cliente_id UUID,
  p_trabalhadora_id UUID,
  p_data_servico DATE,
  p_hora_inicio_prevista TIME,
  p_duracao_estimada INTERVAL,
  p_tipo_cobranca_cliente TEXT,
  p_valor_cliente DECIMAL,
  p_tipo_pagamento_trabalhadora TEXT,
  p_valor_trabalhadora DECIMAL,
  p_status TEXT,
  p_checklist JSONB,
  p_observacoes_trabalhadora TEXT,
  p_hora_inicio_real TIMESTAMPTZ,
  p_hora_fim_real TIMESTAMPTZ
)
RETURNS servicos AS $$
DECLARE
  new_row servicos;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO servicos (
    cliente_id,
    trabalhadora_id,
    data_servico,
    hora_inicio_prevista,
    duracao_estimada,
    tipo_cobranca_cliente,
    valor_cliente,
    tipo_pagamento_trabalhadora,
    valor_trabalhadora,
    status,
    checklist,
    observacoes_trabalhadora,
    hora_inicio_real,
    hora_fim_real
  )
  VALUES (
    p_cliente_id,
    p_trabalhadora_id,
    p_data_servico,
    p_hora_inicio_prevista,
    p_duracao_estimada,
    p_tipo_cobranca_cliente,
    p_valor_cliente,
    p_tipo_pagamento_trabalhadora,
    p_valor_trabalhadora,
    COALESCE(p_status, 'agendado'),
    p_checklist,
    p_observacoes_trabalhadora,
    p_hora_inicio_real,
    p_hora_fim_real
  )
  RETURNING * INTO new_row;

  RETURN new_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION rpc_admin_update_servico(
  p_id UUID,
  p_cliente_id UUID,
  p_trabalhadora_id UUID,
  p_data_servico DATE,
  p_hora_inicio_prevista TIME,
  p_duracao_estimada INTERVAL,
  p_tipo_cobranca_cliente TEXT,
  p_valor_cliente DECIMAL,
  p_tipo_pagamento_trabalhadora TEXT,
  p_valor_trabalhadora DECIMAL,
  p_status TEXT,
  p_checklist JSONB,
  p_observacoes_trabalhadora TEXT,
  p_hora_inicio_real TIMESTAMPTZ,
  p_hora_fim_real TIMESTAMPTZ
)
RETURNS servicos AS $$
DECLARE
  updated_row servicos;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE servicos
  SET
    cliente_id = COALESCE(p_cliente_id, cliente_id),
    trabalhadora_id = COALESCE(p_trabalhadora_id, trabalhadora_id),
    data_servico = COALESCE(p_data_servico, data_servico),
    hora_inicio_prevista = COALESCE(p_hora_inicio_prevista, hora_inicio_prevista),
    duracao_estimada = COALESCE(p_duracao_estimada, duracao_estimada),
    tipo_cobranca_cliente = COALESCE(p_tipo_cobranca_cliente, tipo_cobranca_cliente),
    valor_cliente = COALESCE(p_valor_cliente, valor_cliente),
    tipo_pagamento_trabalhadora = COALESCE(p_tipo_pagamento_trabalhadora, tipo_pagamento_trabalhadora),
    valor_trabalhadora = COALESCE(p_valor_trabalhadora, valor_trabalhadora),
    status = COALESCE(p_status, status),
    checklist = COALESCE(p_checklist, checklist),
    observacoes_trabalhadora = COALESCE(p_observacoes_trabalhadora, observacoes_trabalhadora),
    hora_inicio_real = COALESCE(p_hora_inicio_real, hora_inicio_real),
    hora_fim_real = COALESCE(p_hora_fim_real, hora_fim_real)
  WHERE id = p_id
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION rpc_admin_delete_servico(p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  DELETE FROM servicos WHERE id = p_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION rpc_admin_create_servico(UUID, UUID, DATE, TIME, INTERVAL, TEXT, DECIMAL, TEXT, DECIMAL, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_admin_update_servico(UUID, UUID, UUID, DATE, TIME, INTERVAL, TEXT, DECIMAL, TEXT, DECIMAL, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_admin_delete_servico(UUID) TO authenticated;
