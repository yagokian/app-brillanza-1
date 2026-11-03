import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ends the session and goes back to /login. Used by the sign-out button (POST)
// and by requireUser when an account was deactivated (GET ?motivo=inativo).
async function signOut(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("motivo") === "inativo") {
    url.searchParams.set("erro", "inativo");
  }
  return NextResponse.redirect(url, { status: 303 });
}

export const GET = signOut;
export const POST = signOut;
