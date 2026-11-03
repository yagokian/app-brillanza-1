import { FIN_ROLES, requireUser } from "@/lib/auth";
import { ContasList, type ContasParams } from "../contas-list";

export default async function ContasPagarPage({ searchParams }: { searchParams: Promise<ContasParams> }) {
  await requireUser({ role: FIN_ROLES });
  return <ContasList natureza="pagar" params={await searchParams} />;
}
