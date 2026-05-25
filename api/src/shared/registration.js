"use strict";

function formatRegistration(row) {
  const id = row.id ?? (row._id != null ? String(row._id) : undefined);
  return {
    id,
    fullName: row.fullName,
    isAttending: !!row.isAttending,
    attendeesBelow5: row.attendeesBelow5 ?? row.attendees0to5 ?? row.attendeesBelow6 ?? 0,
    attendeesBetween5And15:
      row.attendeesBetween5And15 ??
      row.attendeesBetween5And10 ??
      row.attendees5to15 ??
      row.attendeesAge6To16 ??
      0,
    attendeesAbove15:
      row.attendeesAbove15 ?? row.attendeesAbove10 ?? row.attendees15Plus ?? row.attendeesAbove16 ?? 0,
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

  let attendeesBelow5 = 0;
  let attendeesBetween5And15 = 0;
  let attendeesAbove15 = 0;

  if (isAttending) {
    attendeesBelow5 = parseNonNegativeInt(
      body?.attendeesBelow5 ?? body?.attendees0to5,
      "attendeesBelow5"
    );
    attendeesBetween5And15 = parseNonNegativeInt(
      body?.attendeesBetween5And15 ?? body?.attendeesBetween5And10 ?? body?.attendees5to15,
      "attendeesBetween5And15"
    );
    attendeesAbove15 = parseNonNegativeInt(
      body?.attendeesAbove15 ?? body?.attendeesAbove10 ?? body?.attendees15Plus,
      "attendeesAbove15"
    );
    const total = attendeesBelow5 + attendeesBetween5And15 + attendeesAbove15;
    if (total < 1) {
      throw new Error("Enter at least one attendee when attending");
    }
  }

  return {
    fullName,
    isAttending,
    attendeesBelow5,
    attendeesBetween5And15,
    attendeesAbove15,
  };
}

module.exports = { formatRegistration, parseRegistrationBody };
