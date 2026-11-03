export const SERVICE_STATUSES = ["agendado", "em_andamento", "concluido", "cancelado"] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

// The business runs in Barcelona: "today" is always Madrid time, whatever the server's zone.
export function todayInMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

// Row returned by rpc_minha_agenda (no financial fields by design).
export type WorkerService = {
  id: string;
  data_servico: string;
  hora_inicio_prevista: string | null;
  duracao_estimada: string | null;
  status: ServiceStatus;
  checklist: Record<string, boolean>;
  observacoes_trabalhadora: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  cliente_nome: string;
  cliente_endereco: string | null;
  cliente_codigo_postal: string | null;
  cliente_cidade: string | null;
  cliente_telefone: string | null;
  cliente_notas: string | null;
};
