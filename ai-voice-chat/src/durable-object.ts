import { DurableObject } from "cloudflare:workers";

export interface Env {
  CHAT_SESSIONS: DurableObjectNamespace<ChatSession>;
  GEMINI_API_KEY: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export class ChatSession extends DurableObject {
  private messages: Message[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Restore persisted messages on startup
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Message[]>("messages");
      if (stored) this.messages = stored;
    });
  }

  async addMessage(message: Message): Promise<void> {
    this.messages.push(message);
    await this.ctx.storage.put("messages", this.messages);
  }

  async getMessages(): Promise<Message[]> {
    return this.messages;
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
    await this.ctx.storage.delete("messages");
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/messages") {
      return Response.json(this.messages);
    }

    if (request.method === "POST" && url.pathname === "/messages") {
      const message = await request.json<Message>();
      await this.addMessage(message);
      return Response.json({ ok: true });
    }

    if (request.method === "DELETE" && url.pathname === "/messages") {
      await this.clearMessages();
      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  }
}
