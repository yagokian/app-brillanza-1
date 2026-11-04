# Brillanza — estado do projeto

Atualizado em 04/11/2026. Leia isto antes de retomar o trabalho.

## Onde estamos

- O sistema está **no ar para teste**: https://brillanza.vercel.app
- Uma pessoa (perfil **financeiro**) vai testar com dados de mentira. Ela recebeu o aviso de protótipo, um roteiro de teste e o manual.
- **Estamos aguardando o retorno dela.** Nada foi mudado depois do envio.

## O que já está pronto

| Parte | O que faz |
|---|---|
| Login e 2FA | Login por e-mail e senha, troca da senha provisória no 1º acesso, código 2FA obrigatório para admin e financeiro |
| Clientes e colaboradoras | Cadastro, edição, desativação |
| Agenda / serviços | Criar, editar, cancelar com motivo, excluir (só se o serviço nunca começou) |
| App da colaboradora | Ver os serviços do dia, iniciar e concluir |
| Informes | Por período, cliente e colaboradora |
| RGPD | Aviso de privacidade, exportar e apagar dados |
| Financeiro | Contas a pagar e a receber, parcelas, pagamentos parciais, juros/multa/desconto, estorno, cancelamento com justificativa, anexos (PDF/imagem até 4 MB), histórico, painel, resultados (receita x despesas) e cadastros auxiliares |
| Usuários | O admin cria outros admins e usuários financeiro em Financeiro → Usuários |

A colaboradora **nunca** vê nada do financeiro.

## Perfis de acesso

- **admin**: tudo.
- **financeiro**: só o módulo financeiro (painel, a pagar, a receber, resultados, cadastros). Não cadastra clientes nem colaboradoras.
- **worker** (colaboradora): só os próprios serviços.

## Onde fica cada coisa

- Código: pasta `web/` (Next.js + Supabase), branch `feat/web-fase-1`.
- Tudo commitado e enviado (último commit `2a767fd`). PR aberto: https://github.com/yagokian/app-brillanza-1/pull/1 (ainda **não** foi para a `main`).
- Banco: Supabase na UE (projeto `vzehlszyxkmeiagxdphd`). As migrações SQL são rodadas à mão no painel do Supabase.
- Site: Vercel, time `brillanza1`, projeto `brillanza`, servidores em Frankfurt.
- Manual: https://claude.ai/artifact/1c3qN6hcFqL4nRUh8vXf6e e o arquivo `Manual-Brillanza.pdf` na pasta do projeto.

## Tecnologias

- **Next.js 16** (React + TypeScript): telas e lógica do servidor.
- **Tailwind 4 + shadcn/ui**: visual e componentes.
- **Supabase** (Postgres na UE): banco de dados, login, 2FA e arquivos.
- **next-intl**: idiomas espanhol e português.
- **Vercel**: hospedagem do site.

## Estrutura do projeto

```
app-brillanza/
├── ESTADO-DO-PROJETO.md      este documento
├── Manual-Brillanza.pdf      manual (fora do git)
├── (app Expo antigo)         abandonado, não mexer
└── web/                      o sistema atual
    ├── CLAUDE.md             regras do projeto para o assistente
    ├── messages/             textos da tela: es.json e pt.json
    ├── supabase/
    │   ├── migrations/       SQL do banco (rodado à mão no Supabase)
    │   └── tests/            testes de permissão do banco
    ├── vercel.json           servidores em Frankfurt
    └── src/
        ├── proxy.ts          protege as rotas (login obrigatório)
        ├── lib/              login/permissões, Supabase, datas, dinheiro, anexos, RGPD
        ├── components/       menu, layout e componentes visuais
        └── app/              as telas
            ├── login, cambiar-contrasena, verificacion   entrada, senha e 2FA
            ├── privacidad                                aviso de privacidade
            ├── admin/        painel do dia, agenda, clientes, colaboradoras, informes
            ├── agenda/       app da colaboradora
            └── financeiro/   painel, pagar, receber, documentos, resultados,
                              cadastros, usuários e download de anexos
```

### Banco de dados (principais tabelas)

- `profiles`: usuários e o perfil de cada um (admin, financeiro, worker).
- `clientes`, `servicos`: clientes e a agenda.
- `audit_log`: registro de quem viu ou exportou dados pessoais.
- `fin_documentos`, `fin_parcelas`, `fin_movimentos`, `fin_anexos`, `fin_historico`: o financeiro.
- `fin_favorecidos`, `fin_categorias`, `fin_formas_pagamento`, `fin_contas`: cadastros do financeiro.

Toda mudança no financeiro passa por funções do banco (`rpc_fin_*`), que travam a linha, evitam lançamento duplicado e gravam histórico. Nada é apagado: estorno vira um lançamento novo.

### Como testar o código

Dentro de `web/`:

```bash
npx tsc --noEmit
npm run lint
npm run build
npm run test:db
```

## Como publicar uma correção

Fazer `git push` **não** atualiza o site. Depois de corrigir, rodar dentro de `web/`:

```bash
npx vercel deploy --prod --yes --scope brillanza1
```

Se houver SQL novo, rodar primeiro no Supabase.

## Quando a testadora responder

1. Juntar o que ela relatou (prints ajudam).
2. Separar em: erro, coisa confusa, pedido novo.
3. Corrigir erros e coisas confusas, testar, publicar com o comando acima.
4. Pedidos novos: decidir juntos se entram agora ou depois.
5. Commit e push só quando for pedido.

## Limitações conhecidas

- Anexos não podem ser apagados depois de enviados (de propósito, para auditoria).
- O aviso de privacidade ainda não fala dos dados financeiros.
- No celular, o menu de baixo do admin tem 6 itens e "Colaboradoras" aparece cortado.
- Se alguém perder o celular do 2FA, é preciso remover o fator no painel do Supabase (Authentication → Users).
- Não deu para testar dois usuários pagando a mesma conta ao mesmo tempo (o código trava, mas não foi testado no banco real).

## Próximos passos (fase 6)

- Domínio próprio (ex.: app.brillanza.es).
- Atualizar o aviso de privacidade com os dados financeiros.
- Arrumar o menu do celular do admin.
- Ligar o GitHub ao Vercel para publicar sozinho a cada push (precisa instalar o app do Vercel na conta GitHub `yagokian`).
- Juntar o PR na `main`.
- Antes de usar de verdade: apagar os dados de teste (só fica o admin).

## Regras do projeto

- Não commitar `web/web/` (sobra de build) nem `Manual-Brillanza.pdf`.
- Senhas reais quem digita é o dono, nunca o assistente.
- Nunca editar uma migração SQL que já foi aplicada; criar outra nova.
- A chave secreta do Supabase fica só no servidor.
