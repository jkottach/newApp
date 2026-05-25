"use strict";

function formatRegistration(row) {
  const id = row.id ?? (row._id != null ? String(row._id) : undefined);
  return {
    id,
    fullName: row.fullName,
    isAttending: !!row.isAttending,
    attendees0to5: row.attendees0to5 ?? row.attendeesBelow5 ?? row.attendeesBelow6 ?? 0,
    attendees5to15:
      row.attendees5to15 ?? row.attendeesBetween5And10 ?? row.attendeesAge6To16 ?? 0,
    attendees15Plus: row.attendees15Plus ?? row.attendeesAbove10 ?? row.attendeesAbove16 ?? 0,
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

  let attendees0to5 = 0;
  let attendees5to15 = 0;
  let attendees15Plus = 0;

  if (isAttending) {
    attendees0to5 = parseNonNegativeInt(
      body?.attendees0to5 ?? body?.attendeesBelow5,
      "attendees0to5"
    );
    attendees5to15 = parseNonNegativeInt(
      body?.attendees5to15 ?? body?.attendeesBetween5And10,
      "attendees5to15"
    );
    attendees15Plus = parseNonNegativeInt(
      body?.attendees15Plus ?? body?.attendeesAbove10,
      "attendees15Plus"
    );
    const total = attendees0to5 + attendees5to15 + attendees15Plus;
    if (total < 1) {
      throw new Error("Enter at least one attendee when attending");
    }
  }

  return {
    fullName,
    isAttending,
    attendees0to5,
    attendees5to15,
    attendees15Plus,
  };
}

module.exports = { formatRegistration, parseRegistrationBody };
