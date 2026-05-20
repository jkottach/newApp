"use strict";

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLocalDevOrigin(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const h = u.hostname;
    const p = u.protocol;
    if (p !== "http:" && p !== "https:") return false;
    return h === "localhost" || h === "127.0.0.1";
  } catch {
    return false;
  }
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  const configured = parseCorsOrigins();
  if (configured.includes(origin)) return true;
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd && isLocalDevOrigin(origin)) return true;
  return false;
}

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    return {};
  }
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return headers;
}

function withCors(request, response) {
  return {
    ...response,
    headers: {
      ...corsHeaders(request),
      ...response.headers,
    },
  };
}

module.exports = { corsHeaders, withCors, isOriginAllowed };
