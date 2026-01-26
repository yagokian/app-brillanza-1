-- RPCs for admin to manage clientes safely
-- This avoids RLS timeout issues when inserting/updating

CREATE OR REPLACE FUNCTION rpc_create_cliente(
  p_nome TEXT,
  p_endereco TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_data_contratacao DATE DEFAULT NULL,
  p_tipo_servico TEXT DEFAULT NULL,
  p_frequencia TEXT DEFAULT NULL,
  p_duracao_horario TEXT DEFAULT NULL,
  p_dia_semana TEXT DEFAULT NULL,
  p_tipo_cobranca TEXT DEFAULT NULL,
  p_valor_acordado NUMERIC DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_aceite_lgpd BOOLEAN DEFAULT FALSE,
  p_data_aceite_lgpd TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem criar clientes';
  END IF;

  INSERT INTO clientes (
    nome, endereco, telefone, email, data_contratacao,
    tipo_servico, frequencia, duracao_horario, dia_semana,
    tipo_cobranca, valor_acordado, observacoes, aceite_lgpd, data_aceite_lgpd
  ) VALUES (
    p_nome, p_endereco, p_telefone, p_email, p_data_contratacao,
    p_tipo_servico, p_frequencia, p_duracao_horario, p_dia_semana,
    p_tipo_cobranca, p_valor_acordado, p_observacoes, p_aceite_lgpd, p_data_aceite_lgpd
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION rpc_update_cliente(
  p_id UUID,
  p_nome TEXT,
  p_endereco TEXT DEFAULT NULL,
  p_telefone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_data_contratacao DATE DEFAULT NULL,
  p_tipo_servico TEXT DEFAULT NULL,
  p_frequencia TEXT DEFAULT NULL,
  p_duracao_horario TEXT DEFAULT NULL,
  p_dia_semana TEXT DEFAULT NULL,
  p_tipo_cobranca TEXT DEFAULT NULL,
  p_valor_acordado NUMERIC DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL,
  p_aceite_lgpd BOOLEAN DEFAULT FALSE,
  p_data_aceite_lgpd TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem atualizar clientes';
  END IF;

  UPDATE clientes SET
    nome = p_nome,
    endereco = p_endereco,
    telefone = p_telefone,
    email = p_email,
    data_contratacao = p_data_contratacao,
    tipo_servico = p_tipo_servico,
    frequencia = p_frequencia,
    duracao_horario = p_duracao_horario,
    dia_semana = p_dia_semana,
    tipo_cobranca = p_tipo_cobranca,
    valor_acordado = p_valor_acordado,
    observacoes = p_observacoes,
    aceite_lgpd = p_aceite_lgpd,
    data_aceite_lgpd = p_data_aceite_lgpd
  WHERE id = p_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION rpc_delete_cliente(p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem excluir clientes';
  END IF;

  DELETE FROM clientes WHERE id = p_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION rpc_create_cliente(TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_update_cliente(UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_delete_cliente(UUID) TO authenticated;
