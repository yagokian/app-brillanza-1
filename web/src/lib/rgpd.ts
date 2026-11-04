// Shared by server and client components.
export type PersonKind = "cliente" | "colaboradora";
export const personTable = { cliente: "clientes", colaboradora: "colaboradoras" } as const;
export const personPath = { cliente: "/admin/clientes", colaboradora: "/admin/colaboradoras" } as const;
