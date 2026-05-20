"use strict";

const { app } = require("@azure/functions");
const { withCors } = require("../shared/cors");

app.http("health", {
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  route: "health",
  handler: async (request) => {
    if (request.method === "OPTIONS") {
      return withCors(request, { status: 204 });
    }
    return withCors(request, {
      status: 200,
      jsonBody: { ok: true },
    });
  },
});
