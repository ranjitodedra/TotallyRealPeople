import { promises as fs } from "fs";
import path from "path";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { env } from "./env";
import type { ReferenceProfile } from "./types";

// Hackathon storage: an in-memory map backed by one JSON file.
// On Render free instances the disk resets on deploy; that's fine for a demo.

type Db = Map<string, ReferenceProfile>;
const g = globalThis as unknown as { __trpDb?: Db; __trpLoaded?: Promise<void> };

const file = () => path.join(process.cwd(), env.dataDir, "references.json");

async function db(): Promise<Db> {
  if (!g.__trpDb) g.__trpDb = new Map();
  if (!g.__trpLoaded) {
    g.__trpLoaded = (async () => {
      try {
        const rows = JSON.parse(await fs.readFile(file(), "utf8")) as ReferenceProfile[];
        for (const r of rows) g.__trpDb!.set(r.id, r);
      } catch {
        /* no file yet */
      }
    })();
  }
  await g.__trpLoaded;
  return g.__trpDb;
}

let writing: Promise<void> = Promise.resolve();
async function flush(d: Db) {
  writing = writing.then(async () => {
    await fs.mkdir(path.dirname(file()), { recursive: true });
    await fs.writeFile(file(), JSON.stringify([...d.values()], null, 2));
  });
  return writing;
}

export function newId(bytes = 9) {
  return randomBytes(bytes).toString("base64url");
}

export const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");

export function checkEditKey(p: ReferenceProfile, key: string | null) {
  if (!p.editKeyHash || !key) return false;
  const a = Buffer.from(p.editKeyHash);
  const b = Buffer.from(hashKey(key));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getReference(id: string) {
  return (await db()).get(id) ?? null;
}

export async function listReferences() {
  return [...(await db()).values()];
}

export async function saveReference(p: ReferenceProfile) {
  const d = await db();
  d.set(p.id, p);
  await flush(d);
  return p;
}

export async function findByEmail(address: string) {
  const a = address.trim().toLowerCase();
  return (await listReferences()).find((p) => p.email?.address.toLowerCase() === a) ?? null;
}

export async function findByInboxId(inboxId: string) {
  return (await listReferences()).find((p) => p.email?.inboxId === inboxId) ?? null;
}
