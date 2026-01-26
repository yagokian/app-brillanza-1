export type UserType = 'admin' | 'worker';

export type ChargeType = 'hora' | 'diaria' | 'fixo';

export type ServiceStatus = 'agendado' | 'em_andamento' | 'concluido' | 'cancelado';

export interface Profile {
  id: string;
  nome: string;
  tipo: UserType;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  data_contratacao: string | null;
  tipo_servico: string | null;
  frequencia: string | null;
  duracao_horario: string | null;
  dia_semana: string | null;
  tipo_cobranca: ChargeType | null;
  valor_acordado: number | null;
  observacoes: string | null;
  aceite_lgpd: boolean;
  data_aceite_lgpd: string | null;
  created_at: string;
}

export interface Trabalhadora {
  id: string;
  user_id: string | null;
  nome: string;
  telefone: string | null;
  tipos_de_servico: string[] | null;
  tipo_pagamento: ChargeType | null;
  valor_pagamento: number | null;
  dias_disponiveis: string[] | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

export interface Servico {
  id: string;
  cliente_id: string;
  trabalhadora_id: string | null;
  data_servico: string;
  hora_inicio_prevista: string | null;
  duracao_estimada: string | null;
  tipo_cobranca_cliente: ChargeType | null;
  valor_cliente: number | null;
  tipo_pagamento_trabalhadora: ChargeType | null;
  valor_trabalhadora: number | null;
  status: ServiceStatus;
  checklist: Record<string, boolean> | null;
  observacoes_trabalhadora: string | null;
  hora_inicio_real: string | null;
  hora_fim_real: string | null;
  created_at: string;
  // Relations
  cliente?: Cliente;
  trabalhadora?: Trabalhadora;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      clientes: {
        Row: Cliente;
        Insert: Omit<Cliente, 'id' | 'created_at'>;
        Update: Partial<Omit<Cliente, 'id' | 'created_at'>>;
      };
      trabalhadoras: {
        Row: Trabalhadora;
        Insert: Omit<Trabalhadora, 'id' | 'created_at'>;
        Update: Partial<Omit<Trabalhadora, 'id' | 'created_at'>>;
      };
      servicos: {
        Row: Servico;
        Insert: Omit<Servico, 'id' | 'created_at'>;
        Update: Partial<Omit<Servico, 'id' | 'created_at'>>;
      };
    };
  };
}
