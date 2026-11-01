import { extractText, getDocumentProxy } from "unpdf";

// PDF upload → plain text. The user can correct the text before building.
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Attach a PDF file." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "PDF is over 8 MB." }, { status: 413 });
  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = String(text).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!clean) return Response.json({ error: "No text found in that PDF. Paste the text instead." }, { status: 422 });
    return Response.json({ text: clean });
  } catch {
    return Response.json({ error: "Couldn't read that PDF. Paste the text instead." }, { status: 422 });
  }
}
