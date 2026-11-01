import { z } from "zod";
import { checkEditKey, getReference, saveReference } from "@/lib/store";
import { toPublic } from "@/lib/types";
import { keepLocked } from "@/lib/qa";
import { phoneNumberFor } from "@/lib/twilio";
import { modelStatus, TEXT_PROVIDERS, VOICE_PROVIDERS } from "@/lib/models";

export async function GET(req: Request, ctx: RouteContext<"/api/references/[id]">) {
  const { id } = await ctx.params;
  const p = await getReference(id);
  if (!p) return Response.json({ error: "Reference not found." }, { status: 404 });
  return Response.json({
    reference: toPublic(p, checkEditKey(p, req.headers.get("x-edit-key"))),
    phone: await phoneNumberFor(p.id),
    models: modelStatus(p),
  });
}

const Patch = z.object({
  facts: z
    .object({
      candidateName: z.string().min(1),
      headline: z.string().optional(),
      roles: z.array(
        z.object({
          company: z.string(),
          title: z.string(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          achievements: z.array(z.string()),
        }),
      ),
      skills: z.array(z.string()),
      education: z.array(z.string()),
    })
    .optional(),
  targetRole: z.object({ title: z.string(), company: z.string().optional(), priorities: z.array(z.string()) }).optional(),
  relevance: z.array(z.string()).optional(),
  unknowns: z.array(z.string()).optional(),
  manager: z.object({ name: z.string().min(1), title: z.string().min(1), company: z.string().min(1) }).optional(),
  qa: z
    .array(z.object({ id: z.string().max(40), question: z.string().max(300), answer: z.string().max(1200), locked: z.boolean().optional(), larp: z.boolean().optional() }))
    .max(30)
    .optional(),
  larps: z
    .array(z.object({ id: z.string().max(40), title: z.string().min(1).max(120), story: z.string().min(1).max(1200) }))
    .max(12)
    .optional(),
  models: z.object({ text: z.enum(TEXT_PROVIDERS).optional(), voice: z.enum(VOICE_PROVIDERS).optional() }).optional(),
});

// Owner edits. Requires the edit key returned at creation (kept in the creator's browser).
export async function PATCH(req: Request, ctx: RouteContext<"/api/references/[id]">) {
  const { id } = await ctx.params;
  const p = await getReference(id);
  if (!p) return Response.json({ error: "Reference not found." }, { status: 404 });
  if (!checkEditKey(p, req.headers.get("x-edit-key"))) {
    return Response.json({ error: "Only the creator can edit this reference." }, { status: 403 });
  }
  const parsed = Patch.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const next = { ...p, ...parsed.data };
  if (parsed.data.qa) next.qa = keepLocked(parsed.data.qa, p.qa);
  if (parsed.data.models) next.models = { ...p.models, ...parsed.data.models };
  await saveReference(next);
  return Response.json({ reference: toPublic(next, true), models: modelStatus(next) });
}
