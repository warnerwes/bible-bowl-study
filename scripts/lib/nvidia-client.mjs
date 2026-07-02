import { readFile } from "fs/promises";
import path from "path";

export const DEFAULT_NVIDIA_API_BASE_URL = "https://integrate.api.nvidia.com";
export const DEFAULT_NVIDIA_RPM = 40;
const DEFAULT_HEADROOM_RATIO = 1.05;
const DEFAULT_MAX_TOKENS = 1024;

let sharedClient = null;

export class NvidiaHttpError extends Error {
  constructor(message, { status = null, retryAfterMs = null, responseText = "" } = {}) {
    super(message);
    this.name = "NvidiaHttpError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.responseText = responseText;
  }
}

export class TokenBucketLimiter {
  constructor({
    rpm = DEFAULT_NVIDIA_RPM,
    headroomRatio = DEFAULT_HEADROOM_RATIO,
    now = () => Date.now(),
    wait = defaultWait,
  } = {}) {
    this.now = now;
    this.wait = wait;
    this.pending = Promise.resolve();
    this.tokens = 0;
    this.lastRefillAt = this.now();
    this.nextEligibleAt = 0;
    this.setRpm(rpm, headroomRatio);
    this.tokens = this.capacity;
  }

  setRpm(rpm, headroomRatio = DEFAULT_HEADROOM_RATIO) {
    const nextRpm = Number.parseInt(rpm, 10);
    if (!Number.isInteger(nextRpm) || nextRpm < 1) {
      throw new Error("NVIDIA RPM must be a positive integer");
    }
    const timestamp = this.now();
    if (this.capacity) {
      this.#refill(timestamp);
    }
    this.capacity = nextRpm;
    this.effectiveRpm = Math.max(1, nextRpm / headroomRatio);
    this.refillPerMs = this.effectiveRpm / 60_000;
    this.minSpacingMs = 60_000 / this.effectiveRpm;
    this.tokens = Math.min(this.tokens || 0, this.capacity);
    this.lastRefillAt = timestamp;
  }

  async acquire() {
    const ticket = this.pending.then(() => this.#acquireLoop());
    this.pending = ticket.catch(() => {});
    return ticket;
  }

  async #acquireLoop() {
    while (true) {
      const delayMs = this.#computeDelayMs();
      if (delayMs <= 0) {
        const grantedAt = this.now();
        this.tokens = Math.max(0, this.tokens - 1);
        this.nextEligibleAt = Math.max(this.nextEligibleAt, grantedAt) + this.minSpacingMs;
        return { grantedAt };
      }
      await this.wait(delayMs);
    }
  }

  #computeDelayMs() {
    const timestamp = this.now();
    this.#refill(timestamp);
    const tokenDelayMs =
      this.tokens >= 1 ? 0 : Math.ceil((1 - this.tokens) / Math.max(this.refillPerMs, 1e-9));
    const spacingDelayMs = Math.max(0, Math.ceil(this.nextEligibleAt - timestamp));
    return Math.max(tokenDelayMs, spacingDelayMs, 0);
  }

  #refill(timestamp) {
    const elapsedMs = Math.max(0, timestamp - this.lastRefillAt);
    if (elapsedMs > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedMs * this.refillPerMs);
      this.lastRefillAt = timestamp;
    }
  }
}

export function normalizeNvidiaBaseUrl(rawBaseUrl) {
  const input = String(rawBaseUrl || DEFAULT_NVIDIA_API_BASE_URL).trim();
  if (!input) {
    return DEFAULT_NVIDIA_API_BASE_URL;
  }
  const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
  return withScheme.replace(/\/+$/, "");
}

export async function resolveNvidiaApiKey({
  env = process.env,
  readFileImpl = readFile,
} = {}) {
  const envKey = String(env.NVIDIA_API_KEY || "").trim();
  if (envKey) {
    return envKey;
  }

  const secretsDir = env.CODEX_SECRETS_DIR || "\\\\nas\\shared\\codex-secrets";
  const envFile = path.join(secretsDir, "nvidia.env");
  let content = "";
  try {
    content = await readFileImpl(envFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error(`Unable to read NVIDIA credentials from ${envFile}: ${error.message}`);
    }
  }

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?NVIDIA_API_KEY\s*=\s*(.+?)\s*$/);
    if (!match) continue;
    const value = match[1].replace(/^['"]|['"]$/g, "").trim();
    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing NVIDIA API key. Set NVIDIA_API_KEY or add NVIDIA_API_KEY=... to ${envFile}.`
  );
}

export function parseRetryAfterMs(headerValue, now = Date.now()) {
  if (headerValue === null || headerValue === undefined || headerValue === "") {
    return null;
  }
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }
  const timestamp = Date.parse(String(headerValue));
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return Math.max(0, timestamp - now);
}

export function createNvidiaClient({
  apiKey,
  baseUrl = process.env.NVIDIA_API_BASE_URL,
  rpm = process.env.NVIDIA_RPM || DEFAULT_NVIDIA_RPM,
  limiter = null,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Global fetch is not available in this Node runtime.");
  }
  const client = {
    baseUrl: normalizeNvidiaBaseUrl(baseUrl),
    limiter: limiter || new TokenBucketLimiter({ rpm }),
    apiKey,
    setRpm(nextRpm) {
      this.limiter.setRpm(nextRpm);
    },
    async chat({
      model,
      prompt,
      temperature = 0,
      maxTokens = DEFAULT_MAX_TOKENS,
    }) {
      await this.limiter.acquire();
      let response;
      try {
        response = await fetchImpl(`${this.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature,
            max_tokens: maxTokens,
          }),
        });
      } catch (error) {
        error.message = `NVIDIA request failed: ${error.message}`;
        throw error;
      }

      const responseText = await response.text();
      if (!response.ok) {
        throw new NvidiaHttpError(buildHttpErrorMessage(response.status, responseText), {
          status: response.status,
          retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
          responseText,
        });
      }

      let payload;
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        throw new Error(`NVIDIA returned invalid JSON: ${error.message}`);
      }

      const content = payload?.choices?.[0]?.message?.content;
      const message = extractAssistantMessage(content);
      if (!message.trim()) {
        throw new Error("NVIDIA response did not include assistant message content.");
      }
      return message;
    },
  };
  return client;
}

export async function getSharedNvidiaClient({ rpm } = {}) {
  if (!sharedClient) {
    sharedClient = createNvidiaClient({
      apiKey: await resolveNvidiaApiKey(),
      rpm,
    });
  } else if (rpm) {
    sharedClient.setRpm(rpm);
  }
  return sharedClient;
}

export function resetSharedNvidiaClientForTests() {
  sharedClient = null;
}

function extractAssistantMessage(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text") return String(part.text || "");
        return "";
      })
      .join("");
  }
  return "";
}

function buildHttpErrorMessage(status, responseText) {
  const body = String(responseText || "").trim();
  if (!body) {
    return `NVIDIA request failed with HTTP ${status}`;
  }
  return `HTTP ${status}: ${truncate(body, 220)}`;
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function defaultWait(ms) {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}
