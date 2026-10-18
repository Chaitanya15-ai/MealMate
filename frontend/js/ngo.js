document.addEventListener("DOMContentLoaded", async () => {
  await connectWallet();

  document.getElementById("register-ngo-btn").addEventListener("click", registerNGO);
  document.getElementById("approve-btn").addEventListener("click", approveNGO);
  document.getElementById("revoke-btn").addEventListener("click", revokeNGO);
  document.getElementById("transfer-admin-btn").addEventListener("click", transferAdmin);
  document.getElementById("refresh-ngo-btn").addEventListener("click", loadAvailable);
  document.getElementById("sort-select").addEventListener("change", loadAvailable);
  document.getElementById("distribute-btn").addEventListener("click", markDistributed);

  if (contract) {
    await maybeShowAdminPanel();
    loadAvailable();
    loadMyAccepted();
    renderProfileBanner("ngo-profile-banner", "ngo", currentAccount);
  }
});

async function maybeShowAdminPanel() {
  try {
    const admin = await contract.admin();
    if (admin.toLowerCase() === currentAccount.toLowerCase()) {
      document.getElementById("admin-panel").style.display = "block";
    }
  } catch (err) {
    console.error(err);
  }
}

async function registerNGO() {
  if (!contract) return showError("Connect your wallet first.");
  const name = document.getElementById("org-name").value.trim();
  const location = document.getElementById("org-location").value.trim();
  if (!name || !location) return showError("Enter organization name and location.");

  try {
    // Only the wallet's role is written on-chain; name/location stay local
    // to this browser (see js/profile.js).
    const tx = await contract.registerNGO();
    await tx.wait();
    saveProfile("ngo", currentAccount, name, location);
    renderProfileBanner("ngo-profile-banner", "ngo", currentAccount);
    alert("Registered as NGO! Waiting for admin approval before you can accept donations.");
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function approveNGO() {
  const address = document.getElementById("approve-address").value.trim();
  if (!address) return showError("Enter an NGO wallet address.");
  try {
    const tx = await contract.approveNGO(address);
    await tx.wait();
    alert("NGO approved.");
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function revokeNGO() {
  const address = document.getElementById("approve-address").value.trim();
  if (!address) return showError("Enter an NGO wallet address.");
  try {
    const tx = await contract.revokeNGO(address);
    await tx.wait();
    alert("NGO approval revoked. It can no longer accept new donations.");
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function transferAdmin() {
  const newAdmin = document.getElementById("new-admin-address").value.trim();
  if (!newAdmin) return showError("Enter the new admin's wallet address.");
  if (!confirm("This permanently hands admin control to " + newAdmin + ". Continue?")) return;
  try {
    const tx = await contract.transferAdmin(newAdmin);
    await tx.wait();
    alert("Admin rights transferred. Reload this page as the new admin wallet to continue approving NGOs.");
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function loadAvailable() {
  if (!contract) return;
  const listEl = document.getElementById("available-list");
  listEl.innerHTML = "Loading...";

  try {
    const ids = await contract.getAllDonationIds();
    let donations = await Promise.all(ids.map((id) => contract.getDonation(id)));
    donations = donations.filter((d) => Number(d.status) === 0); // AVAILABLE only

    const sortBy = document.getElementById("sort-select").value;
    if (sortBy === "expiry") {
      donations.sort((a, b) => Number(a.expiryTime) - Number(b.expiryTime));
    } else {
      donations.sort((a, b) => Number(b.id) - Number(a.id));
    }

    if (donations.length === 0) {
      listEl.innerHTML = "<p class='hint'>No available donations right now.</p>";
      return;
    }

    listEl.innerHTML = "";
    donations.forEach((d) => {
      const risk = expiryRisk(d.expiryTime, Number(d.status));
      const item = document.createElement("div");
      item.className = "donation-item";
      item.innerHTML = `
        <div>
          <strong>FD${d.id.toString().padStart(3, "0")}</strong> — ${d.foodName} (${d.quantity} ${d.unit})
          <div class="meta">Expires: ${formatTimestamp(d.expiryTime)} · Pickup: ${d.pickupLocation}</div>
        </div>
        <div>
          <span class="badge ${risk.css}">${risk.label}</span>
          <button class="accept-btn" data-id="${d.id}" style="margin-left:8px;">Accept</button>
        </div>
      `;
      listEl.appendChild(item);
    });

    listEl.querySelectorAll(".accept-btn").forEach((btn) =>
      btn.addEventListener("click", () => acceptDonation(btn.dataset.id))
    );
  } catch (err) {
    listEl.innerHTML = "<p class='hint'>Could not load donations.</p>";
    console.error(err);
  }
}

async function acceptDonation(id) {
  try {
    const tx = await contract.acceptDonation(id);
    await tx.wait();
    alert("Donation accepted!");
    loadAvailable();
    loadMyAccepted();
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function loadMyAccepted() {
  if (!contract || !currentAccount) return;
  const listEl = document.getElementById("my-accepted-list");
  listEl.innerHTML = "Loading...";

  try {
    const ids = await contract.getNGODonationIds(currentAccount);
    if (ids.length === 0) {
      listEl.innerHTML = "<p class='hint'>No accepted donations yet.</p>";
      return;
    }

    const donations = await Promise.all(ids.map((id) => contract.getDonation(id)));
    listEl.innerHTML = "";

    donations
      .slice()
      .reverse()
      .forEach((d) => {
        const item = document.createElement("div");
        item.className = "donation-item";
        item.innerHTML = `
          <div>
            <strong>FD${d.id.toString().padStart(3, "0")}</strong> — ${d.foodName}
            <div class="meta">Status: ${STATUS_LABELS[Number(d.status)]}</div>
          </div>
          <div>
            ${
              Number(d.status) === 1 && !d.ngoConfirmedCollection
                ? `<button class="confirm-collect-btn" data-id="${d.id}">Confirm Collection</button>`
                : ""
            }
            <a href="verify.html?id=${d.id}" class="btn secondary" style="margin-left:8px; text-decoration:none;">View Passport</a>
          </div>
        `;
        listEl.appendChild(item);
      });

    listEl.querySelectorAll(".confirm-collect-btn").forEach((btn) =>
      btn.addEventListener("click", () => confirmCollection(btn.dataset.id))
    );
  } catch (err) {
    listEl.innerHTML = "<p class='hint'>Could not load donations.</p>";
    console.error(err);
  }
}

async function confirmCollection(id) {
  try {
    const tx = await contract.confirmPickupByNGO(id);
    await tx.wait();
    alert("Collection confirmed.");
    loadMyAccepted();
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function markDistributed() {
  const id = document.getElementById("distribute-id").value;
  const recipientGroup = document.getElementById("recipient-group").value.trim();
  const peopleServed = document.getElementById("people-served").value;

  if (!id || !recipientGroup || !peopleServed) {
    return showError("Fill in food ID, recipient group, and people served.");
  }

  try {
    const tx = await contract.markDistributed(id, recipientGroup, peopleServed);
    await tx.wait();
    alert("Marked as distributed!");
    loadMyAccepted();
  } catch (err) {
    showError(parseContractError(err));
  }
}

function parseContractError(err) {
  const reason = err?.reason || err?.shortMessage || err?.message || "Transaction failed";
  return reason;
}
