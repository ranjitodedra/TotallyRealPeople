import { z } from "zod";
import { extractProfile } from "@/lib/extract";
import { getPersona } from "@/lib/personas";
import { hashKey, newId, saveReference } from "@/lib/store";
import { createInbox } from "@/lib/agentboxd";
import { generateQa } from "@/lib/qa";
import { toPublic, type ReferenceProfile } from "@/lib/types";

const Body = z.object({
  resumeText: z.string().min(40, "The résumé looks too short.").max(40000),
  jobDescriptionText: z.string().min(20, "The job description looks too short.").max(30000),
  personaId: z.string().default("technical-manager"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { resumeText, jobDescriptionText, personaId } = parsed.data;
  const persona = getPersona(personaId);

  let ex;
  try {
    ex = await extractProfile(resumeText, jobDescriptionText);
  } catch (e) {
    console.error("extract failed", e);
    return Response.json({ error: "Couldn't read those documents. Try again." }, { status: 502 });
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
    personaId: persona.id,
    manager: { name: persona.name, title: persona.title, company: ex.managerCompany },
    voice: persona.voice,
    messages: [],
    fakeExtraction: ex.fake,
    editKeyHash: hashKey(editKey),
  };

  const username = `${persona.name.split(" ")[0]}-${id.slice(0, 5)}`.toLowerCase().replace(/[^a-z0-9-]/g, "");
  try {
    const inbox = await createInbox(`ref-${id}`, username, `${persona.name} (AI reference sim)`);
    profile.email = inbox
      ? { address: inbox.address, inboxId: inbox.id, provider: "agentboxd" }
      : { address: `${username}@demo.totallyrealpeople`, provider: "demo" };
  } catch (e) {
    console.error("inbox create failed", e);
    profile.email = { address: `${username}@demo.totallyrealpeople`, provider: "demo" };
  }

  try {
    profile.qa = await generateQa(profile);
  } catch (e) {
    console.error("qa generate failed", e);
    profile.qa = [];
  }

  await saveReference(profile);
  return Response.json({ reference: toPublic(profile, true), editKey });
}
