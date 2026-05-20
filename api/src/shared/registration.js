"use strict";

function formatRegistration(row) {
  const id = row.id ?? (row._id != null ? String(row._id) : undefined);
  return {
    id,
    fullName: row.fullName,
    isAttending: !!row.isAttending,
    attendeesAbove10: row.attendeesAbove10 ?? row.attendeesAbove16 ?? 0,
    attendeesBetween5And10: row.attendeesBetween5And10 ?? row.attendeesAge6To16 ?? 0,
    attendeesBelow5: row.attendeesBelow5 ?? row.attendeesBelow6 ?? 0,
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

  let attendeesAbove10 = 0;
  let attendeesBetween5And10 = 0;
  let attendeesBelow5 = 0;

  if (isAttending) {
    attendeesAbove10 = parseNonNegativeInt(body?.attendeesAbove10, "attendeesAbove10");
    attendeesBetween5And10 = parseNonNegativeInt(
      body?.attendeesBetween5And10,
      "attendeesBetween5And10"
    );
    attendeesBelow5 = parseNonNegativeInt(body?.attendeesBelow5, "attendeesBelow5");
    const total = attendeesAbove10 + attendeesBetween5And10 + attendeesBelow5;
    if (total < 1) {
      throw new Error("Enter at least one attendee when attending");
    }
  }

  return {
    fullName,
    isAttending,
    attendeesAbove10,
    attendeesBetween5And10,
    attendeesBelow5,
  };
}

module.exports = { formatRegistration, parseRegistrationBody };
