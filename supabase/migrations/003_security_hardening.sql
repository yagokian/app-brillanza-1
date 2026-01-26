-- Security hardening for worker access

-- Remove worker direct access to clientes
DROP POLICY IF EXISTS "Worker can view client basic info" ON clientes;

-- Recreate admin policies with explicit WITH CHECK
DROP POLICY IF EXISTS "Admin full access to clientes" ON clientes;
CREATE POLICY "Admin full access to clientes" ON clientes
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin full access to trabalhadoras" ON trabalhadoras;
CREATE POLICY "Admin full access to trabalhadoras" ON trabalhadoras
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin full access to servicos" ON servicos;
CREATE POLICY "Admin full access to servicos" ON servicos
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update profiles" ON profiles;
CREATE POLICY "Admin can update profiles" ON profiles
  FOR UPDATE USING (is_admin())
  WITH CHECK (is_admin());

-- Public view with limited client fields for workers
CREATE OR REPLACE VIEW clientes_publicos
WITH (security_barrier = true) AS
SELECT c.id, c.nome, c.endereco, c.telefone
FROM clientes c
WHERE EXISTS (
  SELECT 1
  FROM servicos s
  JOIN trabalhadoras t ON t.id = s.trabalhadora_id
  WHERE s.cliente_id = c.id
    AND t.user_id = auth.uid()
);

GRANT SELECT ON clientes_publicos TO authenticated;

-- Harden helper functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND tipo = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION get_trabalhadora_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM trabalhadoras
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nome, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'worker')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- RPCs for worker-safe updates on servicos
CREATE OR REPLACE FUNCTION rpc_start_servico(p_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE servicos
  SET status = 'em_andamento',
      hora_inicio_real = NOW()
  WHERE id = p_id
    AND trabalhadora_id = get_trabalhadora_id()
    AND status = 'agendado';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION rpc_finish_servico(p_id UUID, p_observacoes TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE servicos
  SET status = 'concluido',
      hora_fim_real = NOW(),
      observacoes_trabalhadora = p_observacoes
  WHERE id = p_id
    AND trabalhadora_id = get_trabalhadora_id()
    AND status = 'em_andamento';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION rpc_save_observacoes(p_id UUID, p_observacoes TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE servicos
  SET observacoes_trabalhadora = p_observacoes
  WHERE id = p_id
    AND trabalhadora_id = get_trabalhadora_id();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION rpc_start_servico(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_finish_servico(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rpc_save_observacoes(UUID, TEXT) TO authenticated;

-- Remove direct write access to servicos for authenticated users
REVOKE INSERT, UPDATE, DELETE ON servicos FROM authenticated;
