import { z } from "zod";
import { handleInboundEmail, isAutomated } from "@/lib/email-flow";
import { getReference } from "@/lib/store";
import { toPublic } from "@/lib/types";

const Body = z.object({
  from: z.string().min(3).max(200),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(4000),
});

// In-app "send a test email": runs the same reply path as the real webhook, marked as demo.
export async function POST(req: Request, ctx: RouteContext<"/api/references/[id]/email-demo">) {
  const { id } = await ctx.params;
  const p = await getReference(id);
  if (!p) return Response.json({ error: "Reference not found." }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Fill in from, subject, and message." }, { status: 400 });
  if (isAutomated(parsed.data.from, parsed.data.subject, p.email?.address)) {
    return Response.json({ error: "That looks like an automated message, so the reference won't reply." }, { status: 422 });
  }
  try {
    await handleInboundEmail(p, { ...parsed.data, demo: true });
    return Response.json({ reference: toPublic(p) });
  } catch (e) {
    console.error("email demo failed", e);
    return Response.json({ error: "The reference couldn't reply. Try again." }, { status: 502 });
  }
}
