// The app plus the phone bridge on one port, so one ngrok tunnel (or one Render web service) covers both.
// Next.js route handlers can't hold WebSockets, so this wraps Next and takes over one upgrade path:
//   /twiml/media  Twilio Media Stream for phone calls (src/phone/bridge.ts)
// Everything else, including the /twiml/voice and /twiml/sms webhooks, goes to Next as usual.
//
// Dev:  npm run dev:phone     Prod: npm run build && npm run start:phone

import { createServer } from "http";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { WebSocketServer } from "ws";

async function main() {
  const dev = !process.argv.includes("--prod");
  const port = Number(process.env.PORT || 3000);
  if (!dev) (process.env as Record<string, string>).NODE_ENV ||= "production";
  // Load .env.local before the bridge reads lib/env.ts.
  loadEnvConfig(process.cwd(), dev);
  const { handleTwilioStream } = await import("./phone/bridge");

  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  const nextUpgrade = app.getUpgradeHandler();

  const wss = new WebSocketServer({ noServer: true });
  const server = createServer((req, res) => void handle(req, res));
  server.on("upgrade", (req, socket, head) => {
    if (new URL(req.url ?? "/", "http://localhost").pathname === "/twiml/media") {
      wss.handleUpgrade(req, socket, head, (ws) => handleTwilioStream(ws));
    } else {
      void nextUpgrade(req, socket, head); // Next's own sockets (dev reload)
    }
  });
  server.listen(port, () => console.log(`> Ready on http://localhost:${port} (${dev ? "dev" : "prod"}, phone bridge on /twiml/media)`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
