import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Option } from "./servico-form";

// Clients and colaboradoras that can take a new service, plus the ones already on the service being edited.
export async function loadOptions(keep: { clienteId?: string | null; colaboradoraId?: string | null } = {}) {
  const supabase = await createClient();
  const [{ data: clientes }, { data: colaboradoras }] = await Promise.all([
    supabase.from("clientes").select("id, nome, tipo_cobranca, valor_acordado, anonimizado_em").order("nome").limit(1000),
    supabase.from("colaboradoras").select("id, nome, tipo_pagamento, valor_pagamento, ativo").order("nome").limit(500),
  ]);

  return {
    clientes: (clientes ?? [])
      .filter((c) => !c.anonimizado_em || c.id === keep.clienteId)
      .map<Option>((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo_cobranca, valor: c.valor_acordado == null ? null : String(c.valor_acordado) })),
    colaboradoras: (colaboradoras ?? [])
      .filter((c) => c.ativo || c.id === keep.colaboradoraId)
      .map<Option>((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo_pagamento, valor: c.valor_pagamento == null ? null : String(c.valor_pagamento) })),
  };
}
