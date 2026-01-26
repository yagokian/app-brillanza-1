# STATUS DO PROJETO - BRILLANZA LIMPIEZAS

Ultima atualizacao: 2026-01-21

## O que ja foi feito

### Seguranca / Supabase
- Migrations aplicadas e corrigidas (campos de clientes, hardening de seguranca, RPCs admin).
- RLS revisado e limpo: apenas tabelas do Brillanza permanecem com policies.
- Trabalhadora com acesso apenas de leitura aos proprios servicos.
- Atualizacao de servicos pela trabalhadora somente via RPC (observacoes e status).
- Privilegios extras removidos de authenticated (servicos so com SELECT).
- View clientes_publicos atualizada para expor nome, endereco, telefone e tipo_servico.
- **RPCs para clientes** (005_admin_clientes_rpc.sql): rpc_create_cliente, rpc_update_cliente, rpc_delete_cliente - evita timeout de RLS.
- **RPCs para trabalhadoras** (006_admin_trabalhadoras_rpc.sql): rpc_create_trabalhadora, rpc_update_trabalhadora, rpc_delete_trabalhadora - evita timeout de RLS.
- Perfil admin configurado na tabela profiles (necessario para usar as RPCs).

### App (React Native + Expo)
- Tela de login modernizada e funcional (Enter no teclado, botao funcionando).
- Tema atualizado com cores da marca.
- i18n configurado (PT/ES) e carregado no app.
- CRUD completo de clientes com campos da ficha e header com logo.
- Campos obrigatorios marcados com * e validacao reforcada no cadastro/edicao de clientes.
- Mascaras de data/telefone/valor no cadastro/edicao de clientes.
- CRUD completo de trabalhadoras (listar, criar, editar, excluir) com vinculo opcional a usuario.
- Mascaras de telefone e valor nas trabalhadoras.
- CRUD de servicos no admin com seletores (cliente/trabalhadora) e mascaras de data/hora/valor.
- Tela da trabalhadora com acesso a nome/endereco/telefone/tipo de servico e fluxo de iniciar/finalizar.

### Melhorias da Sessao 2026-01-21

#### Correcao de Data (formato DD/MM/AAAA)
- Mascara de data alterada de AAAA-MM-DD para DD/MM/AAAA em todos os formularios.
- Funcoes de conversao: `convertDateToISO()` e `convertISOToDate()` para comunicacao com banco.
- Arquivos alterados: servicos/novo.tsx, servicos/[id].tsx, clientes/novo.tsx, clientes/[id].tsx.

#### Correcao de Navegacao
- **Lista recarrega automaticamente**: Adicionado `useFocusEffect` na listagem de clientes para atualizar ao voltar.
- **Stack reseta ao trocar de aba**: Listener nas tabs para resetar navegacao (evita ficar em tela de detalhe ao trocar aba).
- Arquivo alterado: app/(admin)/_layout.tsx, app/(admin)/clientes/index.tsx.

#### Correcao de Timeout no Cadastro
- Servicos de clientes e trabalhadoras agora usam RPCs ao inves de queries diretas.
- Evita problema de RLS que fazia queries ficarem "pendentes" indefinidamente.
- Arquivos alterados: src/services/clientes.ts, src/services/trabalhadoras.ts.

#### Melhorias no Cadastro de Trabalhadoras
- **Chips clicaveis** para Tipo de Pagamento (Por Hora, Diaria, Fixo) - substituiu dialog.
- **Chips clicaveis** para Dias Disponiveis (Seg, Ter, Qua, Qui, Sex, Sab, Dom) - substituiu dialog.
- **Campo Email** adicionado para criar acesso da trabalhadora.
- **Botao "Criar Acesso"** que gera senha aleatoria de 8 caracteres e cria usuario no Supabase.
- Exibe senha temporaria para o admin anotar e passar para a trabalhadora.
- Campos seletores agora funcionam ao clicar em qualquer parte (nao so na seta).
- Arquivos alterados: app/(admin)/trabalhadoras/nova.tsx, app/(admin)/trabalhadoras/[id].tsx.

### Qualidade
- ESLint configurado e rodando.
- Typecheck rodando.

## O que falta fazer (para finalizar)

### Funcionalidade
1) Relatorios (admin)
   - Definir indicadores e telas (ex.: servicos por periodo, custo, produtividade).
   - Implementar queries e UI.

2) Fluxo completo da trabalhadora (Fase 3)
   - Checklist por servico.
   - Fotos antes/depois.
   - Historico de servicos.
   - Tela de primeiro acesso para forcar troca de senha.

3) Melhorias de UX e consistencia visual
   - Definir layout final (tipografia, cores, espacos, cards).
   - Aplicar padrao nas telas de clientes, trabalhadoras e servicos.
   - Aplicar mesmas melhorias de chips na tela de edicao de trabalhadoras ([id].tsx).

4) Seeds / dados de exemplo
   - Criar dados de teste para validar fluxo (clientes, trabalhadoras, servicos).

5) Testes finais
   - Teste end-to-end admin e trabalhadora (login, CRUD, servicos).
   - Validacao das policies no Supabase com dados reais.

### Ajustes tecnicos opcionais
- Criar scripts no package.json para dev/web.
- Melhorar mascaras de data/hora/valor (biblioteca dedicada).
- Validar performance de listas grandes.
- Remover logs de debug do codigo apos testes.

## Migrations Supabase (executar no SQL Editor)

### Ja aplicadas
- 001_initial_schema.sql
- 002_clientes_campos_adicionais.sql
- 003_security_hardening.sql
- 004_admin_servicos_rpc.sql
- 005_admin_clientes_rpc.sql
- 006_admin_trabalhadoras_rpc.sql

### Configuracao necessaria
Para o admin funcionar, o usuario precisa ter registro na tabela `profiles` com `tipo = 'admin'`:
```sql
INSERT INTO profiles (id, nome, tipo, ativo)
VALUES ('SEU-USER-ID', 'Nome Admin', 'admin', true)
ON CONFLICT (id) DO UPDATE SET tipo = 'admin', ativo = true;
```

## Notas importantes
- Banco exclusivo do Brillanza (policies estranhas removidas).
- Trabalhadora pode ver somente dados essenciais do cliente (nome, endereco, telefone, tipo_servico).
- Todas as alteracoes criticas no Supabase devem ser aplicadas via SQL Editor.
- Se o cadastro nao salvar (timeout), verificar se as RPCs estao aplicadas e se o usuario e admin.
- Apos alteracoes no codigo, fazer reload do app (pressionar 'r' no terminal Expo).
