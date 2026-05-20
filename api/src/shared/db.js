"use strict";

const { MongoClient } = require("mongodb");

const DEFAULT_DATABASE = "usersapp";
const DEFAULT_COLLECTION = "users";

let clientPromise;
let indexesEnsured = false;

async function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("Missing environment variable: MONGODB_URI");
    }
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  return clientPromise;
}

async function getUsersCollection() {
  const client = await getClient();
  const dbName = process.env.MONGODB_DATABASE || DEFAULT_DATABASE;
  const collectionName = process.env.MONGODB_COLLECTION || DEFAULT_COLLECTION;
  const collection = client.db(dbName).collection(collectionName);

  if (!indexesEnsured) {
    await collection.createIndex({ createdAt: -1 });
    indexesEnsured = true;
  }

  return collection;
}

module.exports = { getUsersCollection };
