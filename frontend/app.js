(function () {
  let apiBase =
    typeof window !== "undefined" && window.__API_BASE__ !== undefined && window.__API_BASE__ !== null
      ? String(window.__API_BASE__).trim()
      : "";
  if (!apiBase && typeof location !== "undefined") {
    const h = location.hostname;
    const p = location.port;
    if ((h === "localhost" || h === "127.0.0.1") && p === "8080") {
      apiBase = "http://localhost:3000";
    }
  }

  const form = document.getElementById("user-form");
  const formStatus = document.getElementById("form-status");
  const listEl = document.getElementById("user-list");
  const listError = document.getElementById("list-error");
  const countEl = document.getElementById("count");
  const attendeePanel = document.getElementById("attendee-counts");
  const attendingInputs = form.querySelectorAll('input[name="isAttending"]');

  function apiUrl(path) {
    const base = apiBase.replace(/\/$/, "");
    return `${base}${path}`;
  }

  function displayName(u) {
    return String(u.fullName ?? "").trim();
  }

  function isAttendingValue(u) {
    return u.isAttending === true || u.isAttending === 1;
  }

  function totalAttendees(u) {
    return (
      Number(u.attendeesAbove16 || 0) +
      Number(u.attendeesAge6To16 || 0) +
      Number(u.attendeesBelow6 || 0)
    );
  }

  function sumAllAttendees(users) {
    return users.reduce((sum, u) => {
      if (!isAttendingValue(u)) return sum;
      return sum + totalAttendees(u);
    }, 0);
  }

  function updateCountBadge(users) {
    countEl.textContent = String(sumAllAttendees(users));
  }

  function updateAttendeePanel() {
    const selected = form.querySelector('input[name="isAttending"]:checked');
    const show = selected && selected.value === "yes";
    attendeePanel.hidden = !show;
    attendeePanel.querySelectorAll("input[type='number']").forEach((el) => {
      el.required = show;
      if (!show) el.value = "";
    });
  }

  attendingInputs.forEach((el) => {
    el.addEventListener("change", updateAttendeePanel);
  });

  async function loadUsers() {
    listError.hidden = true;
    listError.textContent = "";
    try {
      const res = await fetch(apiUrl("/api/users"));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderRows(Array.isArray(data) ? data : []);
    } catch (e) {
      listError.hidden = false;
      const msg = e && e.message ? e.message : String(e);
      listError.textContent = `Could not load responses (${msg}). Check API URL, CORS, and the API terminal for errors.`;
      console.error(e);
    }
  }

  function initialsFromName(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function attendanceSummary(u) {
    if (!isAttendingValue(u)) return "Not Attending";
    const total = totalAttendees(u);
    return `Attending · ${total}`;
  }

  function renderRows(users) {
    listEl.innerHTML = "";
    updateCountBadge(users);
    if (!users.length) {
      const li = document.createElement("li");
      li.className = "user-list-empty";
      li.textContent = "No responses yet. Be the first to submit.";
      listEl.appendChild(li);
      return;
    }
    for (const u of users) {
      const name = displayName(u);
      const li = document.createElement("li");
      li.className = "user-card";
      const attending = isAttendingValue(u);
      li.innerHTML = `
        <span class="user-avatar" aria-hidden="true">${escapeHtml(initialsFromName(name))}</span>
        <div class="user-card-body">
          <p class="user-card-name">${escapeHtml(name)}</p>
          <p class="user-card-meta">
            <span class="pill ${attending ? "pill-yes" : "pill-no"}">${attending ? "Yes" : "No"}</span>
            · ${escapeHtml(attendanceSummary(u))}
          </p>
        </div>
      `;
      listEl.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseCount(fd, name) {
    const raw = fd.get(name);
    const n = raw === "" || raw === null ? 0 : Number(raw);
    if (!Number.isInteger(n) || n < 0) return null;
    return n;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    formStatus.textContent = "";
    const fd = new FormData(form);
    const fullName = String(fd.get("fullName") || "").trim();
    const attendingChoice = fd.get("isAttending");

    if (!fullName) {
      formStatus.textContent = "Please enter your name.";
      return;
    }
    if (attendingChoice !== "yes" && attendingChoice !== "no") {
      formStatus.textContent = "Please select Yes or No for attending.";
      return;
    }

    const isAttending = attendingChoice === "yes";
    const payload = { fullName, isAttending };

    if (isAttending) {
      const attendeesAbove16 = parseCount(fd, "attendeesAbove16");
      const attendeesAge6To16 = parseCount(fd, "attendeesAge6To16");
      const attendeesBelow6 = parseCount(fd, "attendeesBelow6");
      if (
        attendeesAbove16 === null ||
        attendeesAge6To16 === null ||
        attendeesBelow6 === null
      ) {
        formStatus.textContent = "Attendee counts must be whole numbers 0 or greater.";
        return;
      }
      const total = attendeesAbove16 + attendeesAge6To16 + attendeesBelow6;
      if (total < 1) {
        formStatus.textContent = "Enter at least one attendee in your group.";
        return;
      }
      payload.attendeesAbove16 = attendeesAbove16;
      payload.attendeesAge6To16 = attendeesAge6To16;
      payload.attendeesBelow6 = attendeesBelow6;
    }

    try {
      const res = await fetch(apiUrl("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        formStatus.textContent = body.error || `Submit failed (${res.status})`;
        return;
      }
      form.reset();
      updateAttendeePanel();
      formStatus.textContent = "Submitted. Thank you!";
      await loadUsers();
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      formStatus.textContent = `Request failed (${msg}). Is the API running on ${apiUrl("") || "(same origin)"}?`;
      console.error(e);
    }
  });

  if (!apiBase) {
    formStatus.textContent = "Set window.__API_BASE__ in env-config.js (or deploy with CI).";
  }
  updateAttendeePanel();
  loadUsers();
})();
