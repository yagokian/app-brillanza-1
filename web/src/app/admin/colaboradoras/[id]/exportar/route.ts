import { requireUser } from "@/lib/auth";
import { exportPerson } from "@/lib/rgpd-export";

// GET ?formato=json|csv: download of the colaboradora's personal data.
export async function GET(request: Request, ctx: RouteContext<"/admin/colaboradoras/[id]/exportar">) {
  await requireUser({ role: "admin" });
  const { id } = await ctx.params;
  return exportPerson("colaboradora", id, new URL(request.url).searchParams.get("formato"));
}
