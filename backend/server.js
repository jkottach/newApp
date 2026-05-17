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

function buildCorsOptions() {
  const configured = parseCorsOrigins();
  const isProd = process.env.NODE_ENV === "production";

  return {
    origin(origin, cb) {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (configured.includes(origin)) {
        cb(null, true);
        return;
      }
      if (!isProd && isLocalDevOrigin(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  };
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

async function migrateLegacyNameColumns(pool) {
  const cols = await pool.request().query(`
    SELECT
      COL_LENGTH('dbo.Users', 'firstName') AS hasFirst,
      COL_LENGTH('dbo.Users', 'lastName') AS hasLast
  `);
  const hasFirst = cols.recordset[0]?.hasFirst != null;
  const hasLast = cols.recordset[0]?.hasLast != null;
  if (!hasFirst && !hasLast) return;

  if (hasFirst && hasLast) {
    await pool.request().query(`
      UPDATE dbo.Users
      SET fullName = LTRIM(RTRIM(CONCAT(ISNULL(firstName, N''), N' ', ISNULL(lastName, N''))))
      WHERE fullName IS NULL OR LTRIM(RTRIM(fullName)) = N'';
    `);
  } else if (hasFirst) {
    await pool.request().query(`
      UPDATE dbo.Users
      SET fullName = LTRIM(RTRIM(firstName))
      WHERE fullName IS NULL OR LTRIM(RTRIM(fullName)) = N'';
    `);
  }

  if (hasFirst) {
    await pool.request().query(`ALTER TABLE dbo.Users DROP COLUMN firstName`);
  }
  if (hasLast) {
    await pool.request().query(`ALTER TABLE dbo.Users DROP COLUMN lastName`);
  }
}

async function ensureSchema(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
    BEGIN
      CREATE TABLE dbo.Users (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        fullName NVARCHAR(200) NOT NULL,
        isAttending BIT NOT NULL DEFAULT 0,
        attendeesAbove16 INT NOT NULL DEFAULT 0,
        attendeesAge6To16 INT NOT NULL DEFAULT 0,
        attendeesBelow6 INT NOT NULL DEFAULT 0,
        createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END

    IF COL_LENGTH('dbo.Users', 'fullName') IS NULL
      ALTER TABLE dbo.Users ADD fullName NVARCHAR(200) NULL;
    IF COL_LENGTH('dbo.Users', 'isAttending') IS NULL
      ALTER TABLE dbo.Users ADD isAttending BIT NOT NULL DEFAULT 0;
    IF COL_LENGTH('dbo.Users', 'attendeesAbove16') IS NULL
      ALTER TABLE dbo.Users ADD attendeesAbove16 INT NOT NULL DEFAULT 0;
    IF COL_LENGTH('dbo.Users', 'attendeesAge6To16') IS NULL
      ALTER TABLE dbo.Users ADD attendeesAge6To16 INT NOT NULL DEFAULT 0;
    IF COL_LENGTH('dbo.Users', 'attendeesBelow6') IS NULL
      ALTER TABLE dbo.Users ADD attendeesBelow6 INT NOT NULL DEFAULT 0;
  `);

  await migrateLegacyNameColumns(pool);

  await pool.request().query(`
    UPDATE dbo.Users
    SET fullName = N'Unknown'
    WHERE fullName IS NULL OR LTRIM(RTRIM(fullName)) = N'';
  `);
}

function formatRegistration(row) {
  return {
    fullName: row.fullName,
    isAttending: !!row.isAttending,
    attendeesAbove16: row.attendeesAbove16,
    attendeesAge6To16: row.attendeesAge6To16,
    attendeesBelow6: row.attendeesBelow6,
  };
}

function parseNonNegativeInt(value, fieldName) {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${fieldName} must be a whole number 0 or greater`);
  }
  return n;
}

function parseRegistrationBody(body) {
  const fullName = String(body?.fullName ?? "").trim();
  if (!fullName) {
    throw new Error("fullName is required");
  }

  const attendingRaw = body?.isAttending;
  let isAttending;
  if (attendingRaw === true || attendingRaw === "true" || attendingRaw === "yes") {
    isAttending = true;
  } else if (attendingRaw === false || attendingRaw === "false" || attendingRaw === "no") {
    isAttending = false;
  } else {
    throw new Error("isAttending must be yes or no");
  }

  let attendeesAbove16 = 0;
  let attendeesAge6To16 = 0;
  let attendeesBelow6 = 0;

  if (isAttending) {
    attendeesAbove16 = parseNonNegativeInt(body?.attendeesAbove16, "attendeesAbove16");
    attendeesAge6To16 = parseNonNegativeInt(body?.attendeesAge6To16, "attendeesAge6To16");
    attendeesBelow6 = parseNonNegativeInt(body?.attendeesBelow6, "attendeesBelow6");
    const total = attendeesAbove16 + attendeesAge6To16 + attendeesBelow6;
    if (total < 1) {
      throw new Error("Enter at least one attendee when attending");
    }
  }

  return {
    fullName,
    isAttending,
    attendeesAbove16,
    attendeesAge6To16,
    attendeesBelow6,
  };
}

const USER_SELECT = `
  SELECT
    fullName,
    isAttending,
    attendeesAbove16,
    attendeesAge6To16,
    attendeesBelow6
  FROM dbo.Users
  ORDER BY createdAt DESC
`;

async function main() {
  const app = express();

  app.use(cors(buildCorsOptions()));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/users", async (_req, res) => {
    try {
      const pool = await getPool();
      await ensureSchema(pool);
      const result = await pool.request().query(USER_SELECT);
      res.json(result.recordset.map(formatRegistration));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    let data;
    try {
      data = parseRegistrationBody(req.body);
    } catch (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    try {
      const pool = await getPool();
      await ensureSchema(pool);
      const insert = await pool
        .request()
        .input("fullName", sql.NVarChar(200), data.fullName)
        .input("isAttending", sql.Bit, data.isAttending)
        .input("attendeesAbove16", sql.Int, data.attendeesAbove16)
        .input("attendeesAge6To16", sql.Int, data.attendeesAge6To16)
        .input("attendeesBelow6", sql.Int, data.attendeesBelow6)
        .query(`
          INSERT INTO dbo.Users (
            fullName, isAttending, attendeesAbove16, attendeesAge6To16, attendeesBelow6
          )
          OUTPUT
            INSERTED.fullName,
            INSERTED.isAttending,
            INSERTED.attendeesAbove16,
            INSERTED.attendeesAge6To16,
            INSERTED.attendeesBelow6
          VALUES (
            @fullName, @isAttending, @attendeesAbove16, @attendeesAge6To16, @attendeesBelow6
          )
        `);
      res.status(201).json(formatRegistration(insert.recordset[0]));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create registration" });
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
