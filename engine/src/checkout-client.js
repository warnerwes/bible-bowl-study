"use strict";

export function buildCheckoutRequestHeaders(idToken) {
  if (!idToken) return {};
  return { Authorization: `Bearer ${idToken}` };
}

export function messageForCheckoutFailure(status, errorCode) {
  if (status === 401) return "SIGN_IN_REQUIRED";
  if (status === 429 && errorCode === "MONTHLY_LIMIT") {
    return "You’ve used your 20 checkouts this month — Bible Gateway is always free.";
  }
  if (status === 429 && errorCode === "rate_limited") {
    return "Reader unavailable right now. Try again in a moment.";
  }
  if (status === 429 && errorCode === "upstream_rate_limited") {
    return "Bible Gateway is free while the in-app reader cools down.";
  }
  if (status === 502 && errorCode === "UPSTREAM_INCOMPLETE") {
    return "That checkout came back incomplete, so nothing was used. Try Bible Gateway below.";
  }
  return `Reader unavailable (HTTP ${status}).`;
}

export async function fetchWeekCheckout({ routeInfo, idToken, fetchImpl = globalThis.fetch, signal }) {
  const url = `/api/checkout?book=${encodeURIComponent(routeInfo.bookApi)}&ch=${routeInfo.chapter}`;
  const response = await fetchImpl(url, {
    cache: "no-store",
    headers: buildCheckoutRequestHeaders(idToken),
    signal,
  });
  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {}
    const error = new Error(messageForCheckoutFailure(response.status, payload?.error));
    error.code = payload?.error || "";
    error.status = response.status;
    throw error;
  }
  return response.json();
}
