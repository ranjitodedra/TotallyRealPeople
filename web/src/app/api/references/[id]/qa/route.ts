import { generateQa } from "@/lib/qa";
import { checkEditKey, getReference, saveReference } from "@/lib/store";
import { toPublic } from "@/lib/types";

// Owner only: rebuild the suggested question bank from the current facts.
// Replaces the list; the menu warns before calling this.
export async function POST(req: Request, ctx: RouteContext<"/api/references/[id]/qa">) {
  const { id } = await ctx.params;
  const p = await getReference(id);
  if (!p) return Response.json({ error: "Reference not found." }, { status: 404 });
  if (!checkEditKey(p, req.headers.get("x-edit-key"))) {
    return Response.json({ error: "Only the creator can tune answers." }, { status: 403 });
  }
  try {
    p.qa = await generateQa(p);
  } catch (e) {
    console.error("qa generate failed", e);
    return Response.json({ error: "Couldn't generate questions. Try again." }, { status: 502 });
  }
  await saveReference(p);
  return Response.json({ reference: toPublic(p, true) });
}
