// Organization name and location are deliberately NOT stored in the smart
// contract - only the wallet's role and registered/approved status live
// on-chain. This file keeps the human-readable profile info locally in the
// browser, keyed by wallet address, so pages can still show "Registered as:
// Restaurant ABC" without writing that data permanently to a public ledger.
//
// This is a simplification for a self-contained frontend-only demo. A real
// deployment would replace this with a small backend/database so a donor's
// profile follows them across browsers and devices instead of staying local
// to one machine.

function saveProfile(role, address, name, location) {
  try {
    localStorage.setItem(
      "profile:" + role + ":" + address.toLowerCase(),
      JSON.stringify({ name, location })
    );
  } catch (err) {
    console.warn("Could not save profile locally:", err);
  }
}

function loadProfile(role, address) {
  try {
    const raw = localStorage.getItem("profile:" + role + ":" + address.toLowerCase());
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function renderProfileBanner(elementId, role, address) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const profile = loadProfile(role, address);
  if (profile) {
    el.textContent = "Registered as: " + profile.name + " · " + profile.location;
    el.style.display = "block";
  } else {
    el.style.display = "none";
  }
}
