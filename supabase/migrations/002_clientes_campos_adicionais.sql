-- Add client form fields to match the app layout
ALTER TABLE clientes
  ADD COLUMN data_contratacao DATE,
  ADD COLUMN duracao_horario TEXT,
  ADD COLUMN dia_semana TEXT;
