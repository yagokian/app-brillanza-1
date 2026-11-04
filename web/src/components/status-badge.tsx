import { useTranslations } from "next-intl";
import type { ServiceStatus } from "@/lib/servicos";
import { cn } from "@/lib/utils";

const styles: Record<ServiceStatus, string> = {
  agendado: "bg-status-agendado/12 text-status-agendado",
  em_andamento: "bg-status-em-andamento/20 text-[oklch(0.5_0.12_70)]",
  concluido: "bg-status-concluido/12 text-status-concluido",
  cancelado: "bg-status-cancelado/12 text-status-cancelado",
};

export function StatusBadge({ status, className }: { status: ServiceStatus; className?: string }) {
  const t = useTranslations("status");
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", styles[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t(status)}
    </span>
  );
}

// Left border in the status colour, for service cards.
export const statusBorder: Record<ServiceStatus, string> = {
  agendado: "border-l-status-agendado",
  em_andamento: "border-l-status-em-andamento",
  concluido: "border-l-status-concluido",
  cancelado: "border-l-status-cancelado",
};
