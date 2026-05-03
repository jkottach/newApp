"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sql = require("mssql");

const PORT = Number(process.env.PORT) || 3000;

const poolConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: process.env.AZURE_SQL_TRUST_SERVER_CERTIFICATE === "true",
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

let poolPromise;

async function getPool() {
  if (!poolPromise) {
    for (const key of ["AZURE_SQL_SERVER", "AZURE_SQL_DATABASE", "AZURE_SQL_USER", "AZURE_SQL_PASSWORD"]) {
      if (!process.env[key]) {
        throw new Error(`Missing environment variable: ${key}`);
      }
    }
    poolPromise = sql.connect(poolConfig);
  }
  return poolPromise;
}

async function ensureSchema(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
    BEGIN
      CREATE TABLE dbo.Users (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        firstName NVARCHAR(100) NOT NULL,
        lastName NVARCHAR(100) NOT NULL,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);
}

async function main() {
  const app = express();
  const origins = parseCorsOrigins();

  app.use(
    cors({
      origin: origins.length ? origins : true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/users", async (_req, res) => {
    try {
      const pool = await getPool();
      await ensureSchema(pool);
      const result = await pool.request().query(`
        SELECT id, firstName, lastName, createdAt
        FROM dbo.Users
        ORDER BY id ASC
      `);
      res.json(result.recordset);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    const firstName = String(req.body?.firstName ?? "").trim();
    const lastName = String(req.body?.lastName ?? "").trim();
    if (!firstName || !lastName) {
      res.status(400).json({ error: "firstName and lastName are required" });
      return;
    }
    try {
      const pool = await getPool();
      await ensureSchema(pool);
      const insert = await pool
        .request()
        .input("firstName", sql.NVarChar(100), firstName)
        .input("lastName", sql.NVarChar(100), lastName)
        .query(`
          INSERT INTO dbo.Users (firstName, lastName)
          OUTPUT INSERTED.id, INSERTED.firstName, INSERTED.lastName, INSERTED.createdAt
          VALUES (@firstName, @lastName)
        `);
      res.status(201).json(insert.recordset[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.listen(PORT, () => {
    console.log(`API listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
