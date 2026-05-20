"use strict";

const { ObjectId } = require("mongodb");
const { app } = require("@azure/functions");
const { withCors } = require("../shared/cors");
const { getUsersCollection } = require("../shared/db");
const { formatRegistration, parseRegistrationBody } = require("../shared/registration");

function parseObjectId(idParam) {
  if (!idParam || !ObjectId.isValid(idParam)) return null;
  return new ObjectId(idParam);
}

app.http("userById", {
  methods: ["GET", "PUT", "OPTIONS"],
  authLevel: "anonymous",
  route: "users/{id}",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") {
      return withCors(request, { status: 204 });
    }

    const objectId = parseObjectId(request.params.id);
    if (!objectId) {
      return withCors(request, {
        status: 400,
        jsonBody: { error: "Invalid id" },
      });
    }

    if (request.method === "GET") {
      try {
        const collection = await getUsersCollection();
        const doc = await collection.findOne({ _id: objectId });
        if (!doc) {
          return withCors(request, {
            status: 404,
            jsonBody: { error: "Registration not found" },
          });
        }
        return withCors(request, {
          status: 200,
          jsonBody: formatRegistration(doc),
        });
      } catch (err) {
        context.error(err);
        return withCors(request, {
          status: 500,
          jsonBody: { error: "Failed to load registration" },
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
      const update = await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: "after" }
      );
      if (!update) {
        return withCors(request, {
          status: 404,
          jsonBody: { error: "Registration not found" },
        });
      }
      return withCors(request, {
        status: 200,
        jsonBody: formatRegistration(update),
      });
    } catch (err) {
      context.error(err);
      return withCors(request, {
        status: 500,
        jsonBody: { error: "Failed to update registration" },
      });
    }
  },
});
