import { Render } from "@renderinc/sdk";
import type { EmailJob } from "@/workflows/main";

// Web-app side of Render Workflows. Off unless RENDER_API_KEY and RENDER_WORKFLOW_SLUG are set,
// so local dev and fake mode keep using the inline reply path.

const slug = () => process.env.RENDER_WORKFLOW_SLUG || "";

export const hasWorkflows = () =>
  slug().length > 0 && (!!process.env.RENDER_API_KEY || process.env.RENDER_USE_LOCAL_DEV === "true");

let client: Render | null = null;

/** Runs answerEmail on Render Workflows and waits for it. Same message id → same run (safe to retry). */
export async function runEmailReply(job: EmailJob, idempotencyKey?: string) {
  client ??= new Render();
  const run = await client.workflows.startTask(`${slug()}/answerEmail`, [job], idempotencyKey ? { idempotencyKey } : undefined);
  const details = await run.get();
  if (details.status !== "succeeded" && details.status !== "completed") {
    throw new Error(`workflow run ${details.id} ${details.status}: ${details.error ?? "no error message"}`);
  }
  const out = (details.results as unknown[])?.[0] as { reply: string; sent: boolean } | undefined;
  if (!out?.reply) throw new Error(`workflow run ${details.id} returned no reply`);
  return { ...out, runId: details.id };
}
