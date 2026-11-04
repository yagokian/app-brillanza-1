import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, icons and the web manifest.
    "/((?!_next/static|_next/image|icons/|logo.png|manifest.webmanifest|favicon.ico).*)",
  ],
};
