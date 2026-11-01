import { generateLarp } from "@/lib/larp";
import { checkEditKey, getReference, saveReference } from "@/lib/store";
import { toPublic } from "@/lib/types";

// Owner only: "Generate Larp". Adds three imagined situations (newest first) and
// fills in / adjusts the tuned answers to match. Locked safety answers stay as they are.
export async function POST(req: Request, ctx: RouteContext<"/api/references/[id]/larp">) {
  const { id } = await ctx.params;
  const p = await getReference(id);
  if (!p) return Response.json({ error: "Reference not found." }, { status: 404 });
  if (!checkEditKey(p, req.headers.get("x-edit-key"))) {
    return Response.json({ error: "Only the creator can generate larps." }, { status: 403 });
  }
  try {
    const out = await generateLarp(p);
    p.larps = out.larps;
    p.qa = out.qa;
  } catch (e) {
    console.error("larp generate failed", e);
    return Response.json({ error: "Couldn't generate a larp. Try again." }, { status: 502 });
  }
  await saveReference(p);
  return Response.json({ reference: toPublic(p, true) });
}
