"use strict";

const { app } = require("@azure/functions");
const { withCors } = require("../shared/cors");
const { getUsersCollection } = require("../shared/db");
const { formatRegistration, parseRegistrationBody } = require("../shared/registration");

app.http("users", {
  methods: ["GET", "POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "users",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") {
      return withCors(request, { status: 204 });
    }

    if (request.method === "GET") {
      try {
        const collection = await getUsersCollection();
        const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
        return withCors(request, {
          status: 200,
          jsonBody: docs.map(formatRegistration),
        });
      } catch (err) {
        context.error(err);
        return withCors(request, {
          status: 500,
          jsonBody: { error: "Failed to load users" },
        });
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return withCors(request, {
        status: 400,
        jsonBody: { error: "Invalid JSON body" },
      });
    }

    let data;
    try {
      data = parseRegistrationBody(body);
    } catch (err) {
      return withCors(request, {
        status: 400,
        jsonBody: { error: err.message },
      });
    }

    try {
      const collection = await getUsersCollection();
      const doc = {
        ...data,
        createdAt: new Date(),
      };
      await collection.insertOne(doc);
      return withCors(request, {
        status: 201,
        jsonBody: formatRegistration(doc),
      });
    } catch (err) {
      context.error(err);
      return withCors(request, {
        status: 500,
        jsonBody: { error: "Failed to create registration" },
      });
    }
  },
});
