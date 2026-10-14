import { searchChunks } from "@/lib/search";
import { NextRequest, NextResponse } from "next/server";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const k = parseInt(searchParams.get("k") || "3", 10);

  if (!q.trim()) {
    return NextResponse.json({ hits: [] });
  }

  const hits = searchChunks(q, k);
  return NextResponse.json({ hits });
}
