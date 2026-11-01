import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };

async function forward(req: NextRequest, ctx: Context) {
  const { path } = await ctx.params;
  const base = process.env.REFBOT_API_URL || "http://127.0.0.1:3001";
  const url = `${base.replace(/\/$/, "")}/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        ...(req.headers.get("content-type") ? { "content-type": req.headers.get("content-type")! } : {}),
        ...(req.headers.get("accept") ? { accept: req.headers.get("accept")! } : {}),
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      cache: "no-store",
    });
    const headers = new Headers();
    for (const name of ["content-type", "cache-control", "connection"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return Response.json({ error: "RefBot service is not running. Start it with `npm run dev` from the project root." }, { status: 502 });
  }
}

export const GET = forward;
export const POST = forward;
export const DELETE = forward;
