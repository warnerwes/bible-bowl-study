import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientUrl = pathToFileURL(path.join(__dirname, "..", "src", "checkout-client.js")).href;

test("checkout client maps error codes to the approved messages", async () => {
  const { messageForCheckoutFailure } = await import(`${clientUrl}?case=messages`);
  assert.equal(
    messageForCheckoutFailure(429, "MONTHLY_LIMIT"),
    "You’ve used your 20 checkouts this month — Bible Gateway is always free."
  );
  assert.equal(
    messageForCheckoutFailure(502, "UPSTREAM_INCOMPLETE"),
    "That checkout came back incomplete, so nothing was used. Try Bible Gateway below."
  );
});

test("checkout client sends the bearer token and returns json on success", async () => {
  const { fetchWeekCheckout } = await import(`${clientUrl}?case=success`);
  const payload = await fetchWeekCheckout({
    routeInfo: { bookApi: "1CO", chapter: 1 },
    idToken: "reader-token",
    fetchImpl: async (url, options) => {
      assert.match(url, /\/api\/checkout\?book=1CO&ch=1$/);
      assert.equal(options.headers.Authorization, "Bearer reader-token");
      return {
        ok: true,
        async json() {
          return { chapters: [] };
        },
      };
    },
  });
  assert.deepEqual(payload, { chapters: [] });
});
