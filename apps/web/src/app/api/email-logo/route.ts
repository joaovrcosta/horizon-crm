import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { DEFAULT_EMAIL_LOGO_URL } from "@horizon/shared";

export const runtime = "nodejs";

async function toDataUri(buffer: Buffer, contentType: string) {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")?.trim();

  try {
    if (rawUrl && /^https:\/\//i.test(rawUrl)) {
      const res = await fetch(rawUrl, {
        headers: { Accept: "image/*" },
        next: { revalidate: 3600 },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || "image/png";
      const buffer = Buffer.from(await res.arrayBuffer());
      return NextResponse.json({
        dataUri: await toDataUri(buffer, contentType.split(";")[0]),
      });
    }

    // fallback: arquivo local em public/brand
    const filePath = path.join(
      process.cwd(),
      "public",
      "brand",
      "halk-logo.png",
    );
    const buffer = await readFile(filePath);
    return NextResponse.json({
      dataUri: await toDataUri(buffer, "image/png"),
      source: "local",
      defaultUrl: DEFAULT_EMAIL_LOGO_URL,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o logo",
      },
      { status: 502 },
    );
  }
}
