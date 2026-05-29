export interface AnnaCompleteResult {
  role?: string;
  content?: { type?: string; text?: string } | string;
  text?: string;
  model?: string;
  stopReason?: string;
  usage?: Record<string, number>;
}

export interface AnnaRuntime {
  llm?: {
    complete: (request: {
      messages: Array<{ role: "system" | "user" | "assistant"; content: string | { type: "text"; text: string } }>;
      maxTokens?: number;
      max_tokens?: number;
      temperature?: number;
      metadata?: Record<string, unknown>;
    }) => Promise<AnnaCompleteResult>;
  };
}

declare global {
  interface Window {
    AnnaAppRuntime?: {
      connect: () => Promise<AnnaRuntime>;
    };
    anna?: AnnaRuntime;
  }
}

let sdkLoadAttempted = false;
let runtimePromise: Promise<AnnaRuntime | null> | null = null;
let lastError = "";

function waitForScript(src: string, timeoutMs = 1400) {
  if (sdkLoadAttempted) return Promise.resolve();
  sdkLoadAttempted = true;
  return new Promise<void>((resolve) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(() => resolve(), timeoutMs);
    script.src = src;
    script.defer = true;
    script.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      resolve();
    };
    document.head.appendChild(script);
  });
}

export function getLastAnnaRuntimeError() {
  return lastError;
}

export function hasAnnaRuntimeGlobal() {
  return Boolean(window.anna?.llm?.complete || window.AnnaAppRuntime);
}

export async function getAnnaRuntime() {
  if (window.anna?.llm?.complete) return window.anna;

  if (!window.AnnaAppRuntime) {
    await waitForScript("/static/anna-apps/_sdk/0.2.0/index.js");
  }

  if (!window.AnnaAppRuntime) {
    lastError = "AnnaAppRuntime global is not available on this page.";
    return null;
  }

  runtimePromise ??= window.AnnaAppRuntime.connect()
    .then((runtime) => {
      window.anna = runtime;
      lastError = "";
      return runtime;
    })
    .catch((error) => {
      lastError = error instanceof Error ? error.message : String(error);
      return null;
    });

  return runtimePromise;
}

export function extractAnnaText(result: AnnaCompleteResult) {
  if (typeof result?.content === "string") return result.content;
  if (typeof result?.content?.text === "string") return result.content.text;
  if (typeof result?.text === "string") return result.text;
  return "";
}

export async function annaCompleteText(args: {
  name: string;
  system: string;
  user: unknown;
  maxTokens?: number;
  temperature?: number;
}) {
  const runtime = await getAnnaRuntime();
  if (!runtime?.llm?.complete) return null;

  const result = await Promise.race([
    runtime.llm.complete({
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: JSON.stringify(args.user, null, 2) },
      ],
      maxTokens: args.maxTokens ?? 2400,
      temperature: args.temperature ?? 0.25,
      metadata: { app: "annawrite", action: args.name },
    }),
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("anna.llm.complete timed out")), 45000)),
  ]);

  return extractAnnaText(result);
}

export function parseJsonFromText<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const jsonText = start >= 0 && end >= start ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(jsonText) as T;
}
