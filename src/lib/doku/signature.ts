import { createHmac, createHash, timingSafeEqual } from "crypto";

const DOKU_CLIENT_ID = process.env.DOKU_CLIENT_ID!;
const DOKU_SECRET_KEY = process.env.DOKU_SECRET_KEY!;
const IS_SANDBOX = process.env.DOKU_SANDBOX === "true";

export function getDokuApiBase() {
  return IS_SANDBOX
    ? "https://api-sandbox.doku.com"
    : "https://api.doku.com";
}

export function getDokuCheckoutJs() {
  return IS_SANDBOX
    ? "https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js"
    : "https://jokul.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js";
}

function generateDigest(jsonBody: string): string {
  return createHash("sha256").update(jsonBody, "utf-8").digest("base64");
}

export function generateSignature(
  clientId: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  jsonBody: string
): string {
  const digest = generateDigest(jsonBody);

  const component = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${requestTimestamp}`,
    `Request-Target:${requestTarget}`,
    `Digest:${digest}`,
  ].join("\n");

  const hmac = createHmac("sha256", DOKU_SECRET_KEY)
    .update(component)
    .digest();

  return `HMACSHA256=${Buffer.from(hmac).toString("base64")}`;
}

export function validateNotificationSignature(
  rawBody: string,
  clientId: string,
  requestId: string,
  requestTimestamp: string,
  requestTarget: string,
  receivedSignature: string
): boolean {
  try {
    const generated = generateSignature(
      clientId,
      requestId,
      requestTimestamp,
      requestTarget,
      rawBody
    );

    if (generated.length !== receivedSignature.length) return false;

    return timingSafeEqual(
      Buffer.from(generated),
      Buffer.from(receivedSignature)
    );
  } catch {
    return false;
  }
}

export function validateResponseSignature(
  responseBody: string,
  requestId: string,
  responseTimestamp: string,
  requestTarget: string,
  receivedSignature: string
): boolean {
  return validateNotificationSignature(
    responseBody,
    DOKU_CLIENT_ID,
    requestId,
    responseTimestamp,
    requestTarget,
    receivedSignature
  );
}

export function generateRequestTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function dokuHeaders(requestId: string, requestTimestamp: string, requestTarget: string, jsonBody: string) {
  return {
    "Client-Id": DOKU_CLIENT_ID,
    "Request-Id": requestId,
    "Request-Timestamp": requestTimestamp,
    "Signature": generateSignature(DOKU_CLIENT_ID, requestId, requestTimestamp, requestTarget, jsonBody),
    "Content-Type": "application/json",
  };
}
