// Database permission tests (RLS, grants, RPCs), run against an in-memory Postgres (PGlite)
// with minimal stand-ins for Supabase's auth schema and roles.
// Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const db = new PGlite();
const q = (s, p) => db.query(s, p);
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function expectErr(fn, m) { try { await fn(); ok(false, m); } catch (e) { ok(true, m + ' -> ' + e.message); } }

// Minimal Supabase stand-ins
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets, name text, owner uuid, unique (bucket_id, name));
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
`);
// Apply every migration in order, as Supabase would.
const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(dir, file), 'utf8'));
}
ok((await q(`select count(*)::int n from information_schema.columns where table_schema='public' and column_name like '%trabalhadora%'`)).rows[0].n === 0, 'no column keeps the old "trabalhadora" name');
ok(true, 'migration applied');

const A = '00000000-0000-0000-0000-00000000000a', W1 = '00000000-0000-0000-0000-0000000000b1', W2 = '00000000-0000-0000-0000-0000000000b2';
await q(`insert into auth.users (id,email,raw_user_meta_data) values ($1,'a@x.es','{"nome":"Ana","tipo":"admin"}'),($2,'w1@x.es','{"nome":"Lu"}'),($3,'w2@x.es','{}')`, [A, W1, W2]);
const p = (await q(`select id,tipo,deve_trocar_senha from public.profiles order by id`)).rows;
ok(p.every(r => r.tipo === 'worker'), 'signup metadata cannot create an admin');
await q(`update public.profiles set tipo='admin' where id=$1`, [A]);
const [t1, t2] = [(await q(`insert into public.colaboradoras (user_id,nome,valor_pagamento) values ($1,'Lu',12) returning id`, [W1])).rows[0].id,
                  (await q(`insert into public.colaboradoras (user_id,nome) values ($1,'Bea') returning id`, [W2])).rows[0].id];
const c = (await q(`insert into public.clientes (nome,endereco,telefone,valor_acordado) values ('Casa Gràcia','C/ Verdi 1','600111222',80) returning id`)).rows[0].id;
const old = (await q(`insert into public.clientes (nome,endereco) values ('Antiga','C/ Vella 2') returning id`)).rows[0].id;
const today = (await q(`select (now() at time zone 'Europe/Madrid')::date as d`)).rows[0].d.toISOString().slice(0,10);
const s1 = (await q(`insert into public.servicos (cliente_id,colaboradora_id,data_servico,valor_cliente,valor_colaboradora) values ($1,$2,$3,80,40) returning id`, [c, t1, today])).rows[0].id;
const s2 = (await q(`insert into public.servicos (cliente_id,colaboradora_id,data_servico) values ($1,$2,$3) returning id`, [c, t2, today])).rows[0].id;
await q(`insert into public.servicos (cliente_id,colaboradora_id,data_servico) values ($1,$2,$3::date - 30)`, [old, t1, today]);

// aal: assurance level in the token ('aal2' = password + TOTP code).
async function as(uid, fn, aal = 'aal1') {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);
    select set_config('request.jwt.claims','{"sub":"${uid}","aal":"${aal}"}',false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); select set_config('request.jwt.claims','',false);`); }
}

// Worker
await as(W1, async () => {
  ok((await q(`select * from public.servicos`)).rows.length === 0, 'worker sees no rows in servicos table');
  ok((await q(`select * from public.clientes`)).rows.length === 0, 'worker sees no rows in clientes table');
  ok((await q(`select * from public.colaboradoras`)).rows.length === 0, 'worker sees no rows in colaboradoras table');
  const ag = (await q(`select * from public.rpc_minha_agenda($1::date - 40, $1::date)`, [today])).rows;
  ok(ag.length === 2, 'agenda returns only own services (2)');
  ok(!('valor_cliente' in ag[0]) && !('valor_colaboradora' in ag[0]), 'agenda has no financial columns');
  const oldRow = ag.find(r => r.cliente_nome === 'Antiga');
  ok(oldRow && oldRow.cliente_endereco === null, 'old service hides client address');
  ok(ag.find(r => r.id === s1).cliente_telefone === '600111222', 'today service shows client phone');
  const det = (await q(`select * from public.rpc_meu_servico($1)`, [s1])).rows;
  ok(det.length === 1 && det[0].cliente_telefone === '600111222', 'detail returns own service');
  ok((await q(`select * from public.rpc_meu_servico($1)`, [s2])).rows.length === 0, 'detail hides other worker service');
  ok((await q(`select * from public.rpc_meu_servico($1)`, [oldRow.id])).rows[0].cliente_endereco === null, 'detail of old service hides client address');
  // No worker-callable RPC may return a column named like a financial value.
  const fin = (await q(`select p.proname, a.n from pg_proc p cross join lateral unnest(p.proargnames) a(n)
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname like 'rpc\\_%' and p.proname not like 'rpc\\_admin\\_%' and p.proname not like 'rpc\\_fin\\_%'
      and a.n ~ '(valor|preco|pagamento|cobranca|margem)'`)).rows;
  ok(fin.length === 0, 'no worker RPC exposes financial columns' + (fin.length ? ' ' + JSON.stringify(fin) : ''));
  ok((await q(`select public.rpc_iniciar_servico($1) r`, [s1])).rows[0].r === true, 'worker starts own service');
  ok((await q(`select public.rpc_iniciar_servico($1) r`, [s2])).rows[0].r === false, 'worker cannot start other worker service');
  ok((await q(`select public.rpc_salvar_checklist($1,'{"Cocina":true}') r`, [s1])).rows[0].r === true, 'worker saves checklist');
  ok((await q(`select public.rpc_finalizar_servico($1,'ok') r`, [s1])).rows[0].r === true, 'worker finishes service');
  await q(`update public.profiles set tipo='admin' where id=$1`, [W1]);
  await expectErr(() => q(`select public.rpc_admin_anonimizar_cliente($1)`, [c]), 'worker cannot call admin RPC');
  await expectErr(() => q(`select public.rpc_admin_registrar_exportacao('clientes',$1,'json')`, [c]), 'worker cannot register an export');
  await q(`select public.rpc_concluir_troca_senha()`); await q(`select public.rpc_definir_idioma('pt')`);
  const me = (await q(`select tipo,idioma,deve_trocar_senha from public.profiles`)).rows;
  ok(me.length === 1 && me[0].tipo === 'worker', 'worker reads only own profile and cannot self-promote');
  ok(me[0].idioma === 'pt' && me[0].deve_trocar_senha === false, 'worker updates own language/password flag via RPC');
  await expectErr(() => q(`select * from public.audit_log`).then(r => { if (r.rows.length === 0) throw new Error('0 rows'); }), 'worker cannot read audit log');
});

// Anonymous
await db.exec(`set role anon`);
await expectErr(() => q(`select * from public.clientes`), 'anon has no table access');
await expectErr(() => q(`select * from public.rpc_minha_agenda(current_date, current_date)`), 'anon cannot call RPC');
await db.exec(`reset role`);

// Admin without 2FA (aal1): no access to data or admin RPCs, only the own profile.
await as(A, async () => {
  ok((await q(`select * from public.clientes`)).rows.length === 0, 'admin at aal1 sees no clients');
  ok((await q(`select * from public.profiles`)).rows.length === 1, 'admin at aal1 reads only own profile');
  await expectErr(() => q(`select public.rpc_admin_anonimizar_cliente($1)`, [c]), 'admin at aal1 cannot anonymise');
  await expectErr(() => q(`select public.rpc_admin_registrar_exportacao('clientes',$1,'json')`, [c]), 'admin at aal1 cannot register an export');
});

// Admin with 2FA (aal2)
await as(A, async () => {
  ok((await q(`select * from public.servicos`)).rows.length === 3, 'admin sees all services');
  const s = (await q(`select status,checklist,hora_fim_real from public.servicos where id=$1`, [s1])).rows[0];
  ok(s.status === 'concluido' && s.checklist.Cocina === true && s.hora_fim_real, 'worker updates persisted');
  const log = (await q(`select acao,campos,usuario_id from public.audit_log where registro_id=$1 order by id`, [s1])).rows;
  ok(log.length === 4 && log[1].usuario_id === W1 && log[1].campos.includes('status'), 'audit log records who/which fields');
  ok((await q(`select public.rpc_admin_anonimizar_cliente($1) r`, [c])).rows[0].r === true, 'admin anonymises client');
  const cc = (await q(`select nome,telefone,anonimizado_em from public.clientes where id=$1`, [c])).rows[0];
  ok(cc.nome === 'Cliente anonimizado' && cc.telefone === null && cc.anonimizado_em, 'client personal data removed');
  ok((await q(`select public.rpc_admin_registrar_exportacao('clientes',$1,'csv') r`, [c])).rows[0].r === true, 'admin registers an export');
  const ex = (await q(`select acao,campos,usuario_id from public.audit_log where registro_id=$1 and acao='EXPORT'`, [c])).rows;
  ok(ex.length === 1 && ex[0].campos[0] === 'csv' && ex[0].usuario_id === A, 'export logged with format and admin');
  ok((await q(`select public.rpc_admin_registrar_exportacao('colaboradoras',$1,'json') r`, [c])).rows[0].r === false, 'export of unknown person is not logged');
  await expectErr(() => q(`select public.rpc_admin_registrar_exportacao('servicos',$1,'json')`, [s1]), 'export only for clientes/colaboradoras');
  ok((await q(`select public.rpc_admin_anonimizar_colaboradora($1) r`, [t2])).rows[0].r === W2, 'worker anonymised, returns login id');
  const wp = (await q(`select nome,ativo from public.profiles where id=$1`, [W2])).rows[0];
  ok(wp.nome === 'Colaboradora anonimizada' && wp.ativo === false, 'anonymised worker profile cleared and deactivated');
  const an = (await q(`select count(*)::int n from public.audit_log where registro_id=$1 and 'anonimizado_em' = any(campos)`, [t2])).rows[0].n;
  ok(an === 1, 'anonymisation is in the audit log');
  await expectErr(() => q(`delete from public.clientes where id=$1`, [c]), 'client with services cannot be hard-deleted');
}, 'aal2');
// ---------------------------------------------------------------------
// Financial module: role 'financeiro' (and admin), always aal2.
// ---------------------------------------------------------------------
const F = '00000000-0000-0000-0000-0000000000f1';
await q(`insert into auth.users (id,email) values ($1,'f@x.es')`, [F]);
await q(`update public.profiles set tipo='financeiro' where id=$1`, [F]);
const c2 = (await q(`insert into public.clientes (nome,endereco) values ('Casa Sarrià','C/ Major 3') returning id`)).rows[0].id;
const one = async (s, p) => (await q(s, p)).rows[0];
const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const uuid = () => crypto.randomUUID();
async function expectCode(fn, code, m) {
  try { await fn(); ok(false, m); } catch (e) { ok(e.message.includes(code), `${m} -> ${e.message}${e.detail ? ` (${e.detail})` : ''}`); }
}
const cat = Object.fromEntries((await q(`select natureza, (array_agg(id order by nome))[1] id from public.fin_categorias group by natureza`)).rows.map((r) => [r.natureza, r.id]));
const conta = (await one(`select id from public.fin_contas limit 1`)).id;
const forma = (await one(`select id from public.fin_formas_pagamento order by nome limit 1`)).id;
const criar = (dados, parcelas, chave = uuid()) =>
  one(`select public.rpc_fin_criar_documento($1::jsonb,$2::jsonb,$3) id`, [JSON.stringify(dados), JSON.stringify(parcelas), chave]).then((r) => r.id);
const mover = (parcela, valor, { juros = 0, multa = 0, desconto = 0, chave = uuid(), data = today } = {}) =>
  one(`select public.rpc_fin_registrar_movimento($1,$2::date,$3,$4,$5,$6,$7,$8,null,$9) id`, [parcela, data, valor, juros, multa, desconto, conta, forma, chave]).then((r) => r.id);
const estornar = (mov, just) => one(`select public.rpc_fin_estornar_movimento($1,$2) id`, [mov, just]).then((r) => r.id);
const parcelasDe = async (doc) => (await q(`select id, numero, valor::float8 valor, valor_liquidado::float8 liq, saldo::float8 saldo from public.fin_parcelas where documento_id=$1 order by numero`, [doc])).rows;
const lista = async (f) => (await q(`select * from public.rpc_fin_listar_parcelas($1::jsonb)`, [JSON.stringify(f)])).rows;
const painel = async () => {
  const r = await one(`select * from public.rpc_fin_painel($1::date,$1::date)`, [today]);
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === 'hoje' ? v : Number(v)]));
};

await as(F, async () => {
  ok((await q(`select * from public.fin_documentos`)).rows.length === 0, 'financeiro at aal1 sees no financial rows');
  await expectCode(() => q(`select * from public.rpc_fin_painel(current_date, current_date)`), 'not authorized', 'financeiro at aal1 cannot call financial RPCs');
});

await as(F, async () => {
  ok((await q(`select * from public.clientes`)).rows.length === 0, 'financeiro cannot read the clientes table');
  ok((await q(`select * from public.servicos`)).rows.length === 0, 'financeiro cannot read the servicos table');
  await expectErr(() => q(`select public.rpc_admin_anonimizar_cliente($1)`, [c2]), 'financeiro cannot call admin RPCs');
  ok((await q(`select * from public.rpc_fin_clientes()`)).rows.some((r) => r.id === c2 && Object.keys(r).length === 3), 'financeiro lists clients by name only');

  // Auxiliary records: insert/update, never delete.
  const fav = (await one(`insert into public.fin_favorecidos (nome, nif) values ('Inmobiliaria Sol','B12345678') returning id`)).id;
  await expectErr(() => q(`delete from public.fin_categorias where id=$1`, [cat.despesa]), 'auxiliary records cannot be deleted');

  // Cash payment (1 installment)
  const chaveAluguel = uuid();
  const aluguel = await criar({ natureza: 'pagar', favorecido_id: fav, descricao: 'Alquiler noviembre', tipo_documento: 'sem_documento', data_emissao: today, valor_total: 900, categoria_id: cat.despesa, condicao: 'a_vista' }, [{ valor: 900, vencimento: today }], chaveAluguel);
  ok((await parcelasDe(aluguel)).length === 1, 'cash document has one installment');
  ok((await criar({ natureza: 'pagar', favorecido_id: fav, descricao: 'x', tipo_documento: 'outro', data_emissao: today, valor_total: 1, categoria_id: cat.despesa, condicao: 'a_vista' }, [{ valor: 1, vencimento: today }], chaveAluguel)) === aluguel, 'same idempotency key returns the same document');
  ok((await one(`select count(*)::int n from public.fin_documentos`)).n === 1, 'resubmitted form creates no duplicate');

  // Installments: 100 / 3 with the rounding cent on the last one.
  const receber = await criar({ natureza: 'receber', cliente_id: c2, descricao: 'Limpieza mensual', tipo_documento: 'fatura', numero: 'F-1', serie: 'A', data_emissao: today, valor_total: 100, categoria_id: cat.receita, condicao: 'parcelado', servico_id: s1 }, [{ valor: 33.33, vencimento: day(0) }, { valor: 33.33, vencimento: day(30) }, { valor: 33.34, vencimento: day(60) }]);
  const pr = await parcelasDe(receber);
  ok(pr.length === 3 && pr.reduce((a, p) => a + p.valor, 0).toFixed(2) === '100.00', 'installments sum to the total (rounding on the last)');
  await expectCode(() => criar({ natureza: 'receber', cliente_id: c2, descricao: 'x', tipo_documento: 'outro', data_emissao: today, valor_total: 100, categoria_id: cat.receita, condicao: 'parcelado' }, [{ valor: 33.33, vencimento: today }, { valor: 33.33, vencimento: today }, { valor: 33.33, vencimento: today }]), 'soma_parcelas', 'installments that do not sum to the total are rejected');
  await expectCode(() => criar({ natureza: 'receber', cliente_id: c2, descricao: 'x', tipo_documento: 'outro', data_emissao: today, valor_total: 10.005, categoria_id: cat.receita, condicao: 'a_vista' }, [{ valor: 10.005, vencimento: today }]), 'valor_invalido', 'more than 2 decimals is rejected, not rounded');
  await expectErr(() => criar({ natureza: 'receber', cliente_id: c2, descricao: 'x', tipo_documento: 'outro', data_emissao: today, valor_total: 10, categoria_id: cat.receita, condicao: 'a_vista' }, [{ valor: 5, vencimento: today }, { valor: 5, vencimento: today }]), 'cash condition with 2 installments is rejected');
  await expectCode(() => criar({ natureza: 'pagar', favorecido_id: fav, descricao: 'x', tipo_documento: 'outro', data_emissao: today, valor_total: 10, categoria_id: cat.receita, condicao: 'a_vista' }, [{ valor: 10, vencimento: today }]), 'categoria_invalida', 'income category on a payable is rejected');
  await expectCode(() => criar({ natureza: 'pagar', cliente_id: c2, favorecido_id: fav, descricao: 'x', tipo_documento: 'outro', data_emissao: today, valor_total: 10, categoria_id: cat.despesa, condicao: 'a_vista' }, [{ valor: 10, vencimento: today }]), 'parte_invalida', 'client and payee at the same time is rejected');

  // Full settlement
  const pa = (await parcelasDe(aluguel))[0];
  await mover(pa.id, 900);
  ok((await parcelasDe(aluguel))[0].saldo === 0, 'full payment settles the installment');
  ok((await lista({ documento_id: aluguel }))[0].situacao_liquidacao === 'quitada', 'status: quitada');

  // Interest, fine and discount are kept apart from the principal.
  const m1 = await mover(pr[0].id, 38.33, { juros: 3, multa: 2 });
  const mv1 = await one(`select valor_principal::float8 p, valor_movimentado::float8 v from public.fin_movimentos where id=$1`, [m1]);
  ok(mv1.p === 33.33 && mv1.v === 38.33 && (await parcelasDe(receber))[0].saldo === 0, 'interest/fine: money 38.33, principal 33.33, installment settled');
  const m2 = await mover(pr[1].id, 30, { desconto: 3.33 });
  const mv2 = await one(`select valor_principal::float8 p, valor_movimentado::float8 v from public.fin_movimentos where id=$1`, [m2]);
  ok(mv2.p === 33.33 && mv2.v === 30 && (await parcelasDe(receber))[1].saldo === 0, 'discount: money 30, principal 33.33, installment settled');

  // Partial and overdue: 300, pay 200, 100 left.
  const atrasada = await criar({ natureza: 'pagar', favorecido_id: fav, descricao: 'Material', tipo_documento: 'nota_fiscal', numero: '77', data_emissao: day(-20), valor_total: 300, categoria_id: cat.despesa, condicao: 'a_prazo' }, [{ valor: 300, vencimento: day(-10) }]);
  const pat = (await parcelasDe(atrasada))[0];
  const m200 = await mover(pat.id, 200, { data: day(-1) });
  const lat = (await lista({ documento_id: atrasada }))[0];
  ok(Number(lat.saldo) === 100 && lat.situacao_liquidacao === 'parcial' && lat.situacao_vencimento === 'vencida', 'partial payment on overdue installment: saldo 100, parcial + vencida');
  ok((await lista({ natureza: 'pagar', situacao: 'vencida' })).some((r) => r.documento_id === atrasada), 'filter by overdue status');
  await expectCode(() => mover(pat.id, 150), 'acima_do_saldo', 'payment above the balance is blocked');
  try { await mover(pat.id, 150); } catch (e) { ok(e.detail === '100.00', 'error reports the balance (100.00)'); }
  await expectCode(() => mover(pat.id, -5), 'valor_invalido', 'negative amount is blocked');
  await expectCode(() => mover(pat.id, 10, { juros: -1 }), 'valor_invalido', 'negative interest is blocked');
  await expectCode(() => mover(pat.id, 10, { data: day(1) }), 'data_invalida', 'future effective date is blocked');

  // Duplicate submission and a second payment for the same balance.
  const chave = uuid();
  const m100 = await mover(pat.id, 100, { chave });
  ok((await mover(pat.id, 100, { chave })) === m100, 'same key returns the same movement (double click)');
  ok((await one(`select count(*)::int n from public.fin_movimentos where parcela_id=$1`, [pat.id])).n === 2 && (await parcelasDe(atrasada))[0].saldo === 0, 'double click settles only once');
  await expectCode(() => mover(pat.id, 100), 'acima_do_saldo', 'second settlement of the same balance is blocked');

  // Reversal
  await expectCode(() => estornar(m100, '  '), 'justificativa_obrigatoria', 'reversal needs a justification');
  const e100 = await estornar(m100, 'Pago en la cuenta equivocada');
  ok((await parcelasDe(atrasada))[0].saldo === 100, 'reversal restores the balance');
  ok((await one(`select count(*)::int n from public.fin_movimentos where id=$1`, [m100])).n === 1, 'original movement is kept');
  await expectCode(() => estornar(m100, 'otra vez'), 'ja_estornado', 'the same movement cannot be reversed twice');
  await expectCode(() => estornar(e100, 'estorno del estorno'), 'invalido', 'a reversal cannot be reversed');
  const h = (await q(`select * from public.rpc_fin_historico($1)`, [atrasada])).rows;
  const hEst = h.find((r) => r.operacao === 'estorno' && r.tabela === 'fin_parcelas');
  ok(hEst && Number(hEst.antes.valor_liquidado) === 300 && Number(hEst.depois.valor_liquidado) === 200 && hEst.justificativa === 'Pago en la cuenta equivocada', 'history keeps old/new values and justification');
  ok(h.every((r) => r.usuario_nome), 'history records the user');

  // Edit restrictions
  const dados = { descricao: 'Material', tipo_documento: 'nota_fiscal', numero: '77', data_emissao: day(-20), categoria_id: cat.despesa, favorecido_id: fav, condicao: 'a_prazo' };
  const editar = (doc, d, p, j) => q(`select public.rpc_fin_editar_documento($1,$2::jsonb,$3::jsonb,$4) r`, [doc, JSON.stringify(d), JSON.stringify(p), j]);
  await expectCode(() => editar(atrasada, { ...dados, valor_total: 350 }, [{ valor: 350, vencimento: day(-10) }], 'ajuste'), 'tem_liquidacao', 'value cannot change after a settlement');
  await expectCode(() => editar(atrasada, { ...dados, valor_total: 300 }, [{ valor: 300, vencimento: day(5) }], ''), 'justificativa_obrigatoria', 'edit after a settlement needs a justification');
  await editar(atrasada, { ...dados, valor_total: 300 }, [{ valor: 300, vencimento: day(5) }], 'Nuevo plazo acordado');
  ok((await lista({ documento_id: atrasada }))[0].situacao_vencimento === 'a_vencer', 'due date can change (with justification) after a settlement');

  // Cancellation
  await expectCode(() => q(`select public.rpc_fin_cancelar_documento($1,'error')`, [atrasada]), 'estornar_antes', 'document with settlements cannot be cancelled before reversing');
  await estornar(m200, 'Devolución');
  ok((await parcelasDe(atrasada))[0].saldo === 300, 'all reversals: full balance back');
  ok((await one(`select public.rpc_fin_cancelar_documento($1,'Factura anulada por el proveedor') r`, [atrasada])).r === true, 'cancel after reversing everything');
  const semMov = await criar({ natureza: 'pagar', favorecido_id: fav, descricao: 'Duplicado', tipo_documento: 'outro', data_emissao: today, valor_total: 50, categoria_id: cat.despesa, condicao: 'a_vista' }, [{ valor: 50, vencimento: today }]);
  await editar(semMov, { ...dados, descricao: 'Duplicado', valor_total: 60, condicao: 'parcelado' }, [{ valor: 30, vencimento: today }, { valor: 30, vencimento: day(30) }], null);
  ok((await parcelasDe(semMov)).length === 2, 'without settlements the installments can be redone');
  await expectCode(() => q(`select public.rpc_fin_cancelar_documento($1,'')`, [semMov]), 'justificativa_obrigatoria', 'cancel needs a justification');
  await q(`select public.rpc_fin_cancelar_documento($1,'Lanzado dos veces')`, [semMov]);
  ok((await lista({ documento_id: semMov }))[0].situacao_liquidacao === 'cancelada', 'status: cancelada');
  const pSem = (await parcelasDe(semMov))[0].id;
  await expectCode(() => mover(pSem, 10), 'documento_cancelado', 'no payment on a cancelled document');
  await expectCode(() => q(`select public.rpc_fin_cancelar_documento($1,'otra')`, [semMov]), 'documento_cancelado', 'cannot cancel twice');

  // No hard deletes, no direct writes.
  await expectErr(() => q(`delete from public.fin_documentos where id=$1`, [semMov]), 'documents cannot be deleted');
  await expectErr(() => q(`update public.fin_parcelas set valor_liquidado=0 where documento_id=$1`, [aluguel]), 'installments cannot be written directly');
  await expectErr(() => q(`insert into public.fin_movimentos (parcela_id) values ($1)`, [pa.id]), 'movements cannot be inserted directly');
  await expectErr(() => q(`delete from public.fin_historico`), 'history cannot be deleted');

  // Dashboard: open balances come from installments only (never document + installments);
  // money moved uses effective dates and subtracts reversals.
  const before = await painel();
  const dash = await criar({ natureza: 'pagar', favorecido_id: fav, descricao: 'Gestoría', tipo_documento: 'fatura', data_emissao: day(-30), valor_total: 500, categoria_id: cat.despesa, condicao: 'parcelado' }, [{ valor: 250, vencimento: day(-5) }, { valor: 250, vencimento: day(-3) }]);
  const afterCreate = await painel();
  ok(afterCreate.pagar_vencido - before.pagar_vencido === 500, 'dashboard: overdue payable +500 (not 1000)');
  const [d1] = await parcelasDe(dash);
  const md = await mover(d1.id, 110, { juros: 10 });
  const afterPay = await painel();
  ok(afterCreate.pagar_vencido - afterPay.pagar_vencido === 100, 'dashboard: open balance drops by the principal (100)');
  ok(afterPay.pago_periodo - afterCreate.pago_periodo === 110, 'dashboard: paid in period counts the money moved (110)');
  await estornar(md, 'Rechazado por el banco');
  const afterRev = await painel();
  ok(afterRev.pago_periodo === afterCreate.pago_periodo && afterRev.pagar_vencido === afterCreate.pagar_vencido, 'dashboard: reversal is subtracted');
  ok(afterRev.saldo_movimentacoes === afterRev.recebido_periodo - afterRev.pago_periodo, 'dashboard: saldo das movimentações = received - paid');
  ok(afterRev.recebido_periodo === 68.33, 'dashboard: received today 38.33 + 30');

  // Attachments: private bucket, registered only after the upload, path tied to the document.
  const path = `${receber}/${uuid()}.pdf`;
  await q(`insert into storage.objects (bucket_id, name) values ('financeiro', $1)`, [path]);
  const anexo = (await one(`select public.rpc_fin_registrar_anexo($1,null,'fatura','Factura F-1.pdf',$2,'application/pdf',1234) id`, [receber, path])).id;
  ok(!!anexo, 'attachment registered after upload');
  await expectCode(() => q(`select public.rpc_fin_registrar_anexo($1,null,'fatura','x.pdf',$2,'application/pdf',10)`, [receber, `${aluguel}/${uuid()}.pdf`]), 'arquivo_invalido', 'attachment path must belong to the document and exist');
  await expectErr(() => q(`select public.rpc_fin_registrar_anexo($1,null,'fatura','x.exe',$2,'application/x-msdownload',10)`, [receber, path.replace('.pdf', '.png')]), 'attachment type is validated');
  ok((await q(`delete from storage.objects where name=$1 returning id`, [path])).rows.length === 0, 'registered attachment file cannot be deleted');
  const orphan = `${receber}/${uuid()}.png`;
  await q(`insert into storage.objects (bucket_id, name) values ('financeiro', $1)`, [orphan]);
  ok((await q(`delete from storage.objects where name=$1 returning id`, [orphan])).rows.length === 1, 'unregistered upload can be cleaned up');

  // Results: revenue and worker cost from finished services, expenses from active payables
  // by issue date. A payable linked to a service is not counted again.
  await criar({ natureza: 'pagar', favorecido_id: fav, descricao: 'Pago colaboradora servicio', tipo_documento: 'recibo', data_emissao: today, valor_total: 40, categoria_id: cat.despesa, condicao: 'a_vista', servico_id: s1 }, [{ valor: 40, vencimento: today }]);
  const res = (await q(`select * from public.rpc_fin_resultados($1::date,$1::date)`, [today])).rows;
  const r0 = res[0];
  ok(res.length === 1 && r0.servicos === 1 && Number(r0.receita_servicos) === 80 && Number(r0.custo_colaboradoras) === 40, 'results: finished services give revenue 80 and worker cost 40');
  ok(Number(r0.despesas) === 900, 'results: expenses 900 (cancelled, receivables and service-linked payables left out)');
  ok(Number(r0.resultado) === -860, 'results: 80 - 40 - 900 = -860');
  const porCat = (await q(`select * from public.rpc_fin_despesas_categoria($1::date,$1::date)`, [today])).rows;
  ok(porCat.length === 1 && Number(porCat[0].total) === 900, 'results: expenses by category match the total');
  ok((await q(`select * from public.rpc_fin_resultados($1::date - 60, $1::date)`, [today])).rows.length >= 3, 'results: one row per month, empty months included');
}, 'aal2');

ok((await one(`select public from storage.buckets where id='financeiro'`)).public === false, 'attachments bucket is private');

// Workers never see anything financial.
await as(W1, async () => {
  for (const t of ['fin_documentos', 'fin_parcelas', 'fin_movimentos', 'fin_anexos', 'fin_historico', 'fin_favorecidos', 'fin_categorias', 'fin_contas', 'fin_formas_pagamento']) {
    ok((await q(`select * from public.${t}`)).rows.length === 0, `worker sees no rows in ${t}`);
  }
  ok((await q(`select * from storage.objects where bucket_id='financeiro'`)).rows.length === 0, 'worker cannot list attachment files');
  await expectErr(() => q(`insert into storage.objects (bucket_id, name) values ('financeiro', 'x/y.pdf')`), 'worker cannot upload attachment files');
  await expectErr(() => q(`insert into public.fin_favorecidos (nome) values ('x')`), 'worker cannot create payees');
  const rpcs = (await q(`select p.oid::regprocedure::text sig, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'rpc\\_fin\\_%'`)).rows;
  ok(rpcs.length >= 10, `financial RPCs found (${rpcs.length})`);
  for (const r of rpcs) {
    const nargs = (r.sig.match(/\(([^)]*)\)/)[1] || '').split(',').filter(Boolean).length;
    await expectCode(() => q(`select * from public.${r.proname}(${Array.from({ length: nargs }, () => 'null').join(',')})`), 'not authorized', `worker cannot call ${r.proname}`);
  }
}, 'aal2');

// Admin (aal2) also has the financial module.
await as(A, async () => {
  ok((await q(`select * from public.fin_documentos`)).rows.length >= 4, 'admin reads financial documents');
  ok(!!(await one(`select * from public.rpc_fin_painel(current_date, current_date)`)), 'admin opens the dashboard');
  // Deleting a service: only if it never started.
  await expectCode(() => q(`delete from public.servicos where id=$1`, [s1]), 'servico_iniciado', 'finished service cannot be deleted');
  ok((await q(`delete from public.servicos where id=$1 returning id`, [s2])).rows.length === 1, 'scheduled service can be deleted');
  ok((await one(`select count(*)::int n from public.audit_log where registro_id=$1 and acao='DELETE'`, [s2])).n === 1, 'service deletion is in the audit log');
}, 'aal2');

await q(`update public.profiles set ativo=false where id=$1`, [F]);
await as(F, async () => ok((await q(`select * from public.fin_documentos`)).rows.length === 0, 'deactivated financeiro loses access'), 'aal2');

await q(`update public.profiles set ativo=false where id=$1`, [A]);
await as(A, async () => ok((await q(`select * from public.servicos`)).rows.length === 0, 'deactivated admin loses access'), 'aal2');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
