import { z } from "zod";
import { extractProfile } from "@/lib/extract";
import { MANAGER } from "@/lib/manager";
import { hashKey, newId, saveReference } from "@/lib/store";
import { createInbox } from "@/lib/agentboxd";
import { generateQa } from "@/lib/qa";
import { matchEmployer } from "@/lib/employers";
import { toPublic, type BuildEvent, type ReferenceProfile } from "@/lib/types";

const Body = z.object({
  resumeText: z.string().min(40, "The résumé looks too short.").max(40000),
  jobDescriptionText: z.string().min(20, "The job description looks too short.").max(30000),
  /** Optional edits from setup step 3. Company must be a résumé employer. */
  manager: z
    .object({ name: z.string().max(60).optional(), title: z.string().max(80).optional(), company: z.string().max(120).optional() })
    .optional(),
  agent: z
    .object({
      tone: z.string().max(400).optional(),
      focusAreas: z.array(z.string().max(80)).max(8).optional(),
      habits: z.array(z.string().max(160)).max(6).optional(),
    })
    .optional(),
});

// Bad input gets a plain JSON 400. Otherwise the response streams one JSON line per step,
// so the browser can show how the Gemini calls are going, then a final "done" or "error" line.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: BuildEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await build(parsed.data, send);
      } catch (e) {
        console.error("build failed", e);
        send({ type: "error", error: "Couldn't build the reference. Try again." });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

async function build(
  { resumeText, jobDescriptionText, manager, agent }: z.infer<typeof Body>,
  send: (e: BuildEvent) => void,
) {
  send({ type: "step", step: "extract" });
  let ex;
  try {
    ex = await extractProfile(resumeText, jobDescriptionText);
  } catch (e) {
    console.error("extract failed", e);
    return send({ type: "error", error: "Couldn't read those documents. Try again." });
  }

  const id = newId();
  const editKey = newId(18);
  const profile: ReferenceProfile = {
    id,
    createdAt: new Date().toISOString(),
    resumeText,
    jobDescriptionText,
    facts: ex.facts,
    targetRole: ex.targetRole,
    relevance: ex.relevance,
    unknowns: ex.unknowns,
    manager: {
      name: manager?.name?.trim() || MANAGER.name,
      title: manager?.title?.trim() || MANAGER.title,
      company: matchEmployer(manager?.company ?? "", ex.facts.roles.map((r) => r.company)) ?? ex.managerCompany,
    },
    agent,
    voice: MANAGER.voice,
    messages: [],
    fakeExtraction: ex.fake,
    editKeyHash: hashKey(editKey),
  };

  send({ type: "step", step: "inbox" });
  const username = `${profile.manager.name.split(" ")[0]}-${id.slice(0, 5)}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
  try {
    const inbox = await createInbox(`ref-${id}`, username, `${profile.manager.name} (AI reference sim)`);
    profile.email = inbox
      ? { address: inbox.address, inboxId: inbox.id, provider: "agentboxd" }
      : { address: `${username}@demo.totallyrealpeople`, provider: "demo" };
  } catch (e) {
    console.error("inbox create failed", e);
    profile.email = { address: `${username}@demo.totallyrealpeople`, provider: "demo" };
  }

  send({ type: "step", step: "questions" });
  try {
    profile.qa = await generateQa(profile);
  } catch (e) {
    console.error("qa generate failed", e);
    profile.qa = [];
  }

  send({ type: "step", step: "save" });
  await saveReference(profile);
  send({ type: "done", reference: toPublic(profile, true), editKey });
}
