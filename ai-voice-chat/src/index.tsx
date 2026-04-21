import { Hono } from "hono";
import { runChatWorkflow } from "./workflow";
import type { Env } from "./durable-object";

export { ChatSession } from "./durable-object";

const app = new Hono<{ Bindings: Env }>();

// POST /api/chat — send a message and get a reply
app.post("/api/chat", async (c) => {
  const { sessionId, message } = await c.req.json<{
    sessionId: string;
    message: string;
  }>();

  if (!sessionId || !message) {
    return c.json({ error: "sessionId and message are required" }, 400);
  }

  const id = c.env.CHAT_SESSIONS.idFromName(sessionId);
  const stub = c.env.CHAT_SESSIONS.get(id);

  // Fetch conversation history from the Durable Object
  const histRes = await stub.fetch(new Request("https://do/messages"));
  const history = await histRes.json<import("./durable-object").Message[]>();

  // Run the Claude workflow
  const { reply, inputTokens, outputTokens } = await runChatWorkflow({
    sessionId,
    userMessage: message,
    history,
    apiKey: c.env.GEMINI_API_KEY,
  });

  // Persist both turns to the Durable Object
  const now = Date.now();
  await stub.fetch(
    new Request("https://do/messages", {
      method: "POST",
      body: JSON.stringify({ role: "user", content: message, timestamp: now }),
    })
  );
  await stub.fetch(
    new Request("https://do/messages", {
      method: "POST",
      body: JSON.stringify({
        role: "assistant",
        content: reply,
        timestamp: now + 1,
      }),
    })
  );

  return c.json({ reply, inputTokens, outputTokens });
});

// DELETE /api/chat — clear conversation history
app.delete("/api/chat", async (c) => {
  const { sessionId } = await c.req.json<{ sessionId: string }>();
  if (!sessionId) return c.json({ error: "sessionId required" }, 400);

  const id = c.env.CHAT_SESSIONS.idFromName(sessionId);
  const stub = c.env.CHAT_SESSIONS.get(id);
  await stub.fetch(new Request("https://do/messages", { method: "DELETE" }));

  return c.json({ ok: true });
});

export default app;
