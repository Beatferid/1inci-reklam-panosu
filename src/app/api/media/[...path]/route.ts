import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readStorageFile } from "@/lib/storage";

type Params = { params: Promise<{ path: string[] }> };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mind": "application/octet-stream",
};

export async function GET(_req: NextRequest, { params }: Params) {
  const { path: parts } = await params;
  const relative = parts.join("/");

  if (!relative.startsWith("uploads/") && !relative.startsWith("targets/")) {
    return NextResponse.json({ error: "Geçersiz yol" }, { status: 400 });
  }

  try {
    const buf = await readStorageFile(relative);
    const ext = path.extname(relative).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Dosya yok" }, { status: 404 });
  }
}
