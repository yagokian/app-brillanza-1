import { useTranslations } from "next-intl";
import { AlertTriangle, Ban, CircleCheck, CircleDashed, CircleDot, Clock, type LucideIcon } from "lucide-react";
import type { SituacaoLiquidacao, SituacaoVencimento } from "@/lib/financeiro";
import { cn } from "@/lib/utils";

// Status always has an icon and a word, never colour alone.
const liq: Record<SituacaoLiquidacao, { icon: LucideIcon; className: string }> = {
  aberta: { icon: CircleDashed, className: "bg-muted text-foreground" },
  parcial: { icon: CircleDot, className: "bg-status-em-andamento/20 text-[oklch(0.5_0.12_70)]" },
  quitada: { icon: CircleCheck, className: "bg-status-concluido/12 text-status-concluido" },
  cancelada: { icon: Ban, className: "bg-status-cancelado/12 text-status-cancelado" },
};

const venc: Record<SituacaoVencimento, { icon: LucideIcon; className: string }> = {
  vencida: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
  vence_hoje: { icon: Clock, className: "bg-status-em-andamento/20 text-[oklch(0.5_0.12_70)]" },
  a_vencer: { icon: Clock, className: "bg-status-agendado/12 text-status-agendado" },
};

function Pill({ icon: Icon, className, label }: { icon: LucideIcon; className: string; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function Situacao({ liquidacao, vencimento }: { liquidacao: SituacaoLiquidacao; vencimento: SituacaoVencimento | null }) {
  const t = useTranslations("finance.status");
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Pill {...liq[liquidacao]} label={t(liquidacao)} />
      {vencimento && <Pill {...venc[vencimento]} label={t(vencimento)} />}
    </span>
  );
}
