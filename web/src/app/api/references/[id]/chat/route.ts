import { z } from "zod";
import { answerAsReference } from "@/lib/answer";
import { getReference } from "@/lib/store";

const Body = z.object({
  history: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(2000) }))
    .min(1)
    .max(30),
});

// Typed Q&A with the reference (fallback for voice, and handy for testing prompts).
export async function POST(req: Request, ctx: RouteContext<"/api/references/[id]/chat">) {
  const { id } = await ctx.params;
  const p = await getReference(id);
  if (!p) return Response.json({ error: "Reference not found." }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success || parsed.data.history.at(-1)?.role !== "user") {
    return Response.json({ error: "Type a question first." }, { status: 400 });
  }
  try {
    const reply = await answerAsReference(p, "chat", parsed.data.history);
    return Response.json({ reply });
  } catch (e) {
    console.error("chat failed", e);
    return Response.json({ error: "The reference couldn't answer. Try again." }, { status: 502 });
  }
}
