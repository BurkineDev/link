import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_SLUGS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  if (!slug || slug.length < 3) {
    return NextResponse.json({ available: false, reason: "too_short" });
  }

  if (!/^[a-z0-9_-]+$/.test(slug)) {
    return NextResponse.json({ available: false, reason: "invalid_chars" });
  }

  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("shops")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  return NextResponse.json({ available: !data });
}
