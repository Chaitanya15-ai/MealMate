document.addEventListener("DOMContentLoaded", async () => {
  await connectWallet();

  document.getElementById("register-donor-btn").addEventListener("click", registerDonor);
  document.getElementById("create-donation-btn").addEventListener("click", createDonation);
  document.getElementById("refresh-donor-btn").addEventListener("click", loadMyDonations);

  if (contract) {
    loadMyDonations();
    renderProfileBanner("donor-profile-banner", "donor", currentAccount);
  }
});

async function registerDonor() {
  if (!contract) return showError("Connect your wallet first.");
  const name = document.getElementById("org-name").value.trim();
  const location = document.getElementById("org-location").value.trim();
  if (!name || !location) return showError("Enter organization name and location.");

  try {
    // Only the wallet's role is written on-chain; name/location stay local
    // to this browser (see js/profile.js).
    const tx = await contract.registerDonor();
    await tx.wait();
    saveProfile("donor", currentAccount, name, location);
    renderProfileBanner("donor-profile-banner", "donor", currentAccount);
    alert("Registered as donor!");
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function createDonation() {
  if (!contract) return showError("Connect your wallet first.");

  const foodName = document.getElementById("food-name").value.trim();
  const category = document.getElementById("food-category").value;
  const quantity = document.getElementById("food-quantity").value;
  const unit = document.getElementById("food-unit").value.trim();
  const expiryLocal = document.getElementById("food-expiry").value;
  const location = document.getElementById("food-location").value.trim();

  if (!foodName || !quantity || !unit || !expiryLocal || !location) {
    return showError("Please fill in all required fields.");
  }

  const expiryUnix = Math.floor(new Date(expiryLocal).getTime() / 1000);
  const nowUnix = Math.floor(Date.now() / 1000);

  try {
    const tx = await contract.createDonation(
      foodName,
      category,
      quantity,
      unit,
      nowUnix,
      expiryUnix,
      location,
      "" // imageCID - left empty in this demo; wire up IPFS upload here if desired
    );
    await tx.wait();
    alert("Donation registered on-chain!");
    loadMyDonations();
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function loadMyDonations() {
  if (!contract || !currentAccount) return;
  const listEl = document.getElementById("donor-donation-list");
  listEl.innerHTML = "Loading...";

  try {
    const ids = await contract.getDonorDonationIds(currentAccount);
    if (ids.length === 0) {
      listEl.innerHTML = "<p class='hint'>No donations yet.</p>";
      return;
    }

    const donations = await Promise.all(ids.map((id) => contract.getDonation(id)));
    listEl.innerHTML = "";

    donations
      .slice()
      .reverse()
      .forEach((d) => {
        const risk = expiryRisk(d.expiryTime, Number(d.status));
        const item = document.createElement("div");
        item.className = "donation-item";
        item.innerHTML = `
          <div>
            <strong>FD${d.id.toString().padStart(3, "0")}</strong> — ${d.foodName} (${d.quantity} ${d.unit})
            <div class="meta">Status: ${STATUS_LABELS[Number(d.status)]} · Expires: ${formatTimestamp(d.expiryTime)}</div>
          </div>
          <div>
            <span class="badge ${risk.css}">${risk.label}</span>
            <a href="verify.html?id=${d.id}" class="btn secondary" style="margin-left:8px; text-decoration:none;">View Passport</a>
            ${
              Number(d.status) === 0 || Number(d.status) === 1
                ? `<button class="secondary cancel-btn" data-id="${d.id}" style="margin-left:8px;">Cancel</button>`
                : ""
            }
            ${
              Number(d.status) === 1 && !d.donorConfirmedHandover
                ? `<button class="confirm-btn" data-id="${d.id}" style="margin-left:8px;">Confirm Handover</button>`
                : ""
            }
          </div>
        `;
        listEl.appendChild(item);
      });

    listEl.querySelectorAll(".cancel-btn").forEach((btn) =>
      btn.addEventListener("click", () => cancelDonation(btn.dataset.id))
    );
    listEl.querySelectorAll(".confirm-btn").forEach((btn) =>
      btn.addEventListener("click", () => confirmHandover(btn.dataset.id))
    );
  } catch (err) {
    listEl.innerHTML = "<p class='hint'>Could not load donations.</p>";
    console.error(err);
  }
}

async function cancelDonation(id) {
  try {
    const tx = await contract.cancelDonation(id);
    await tx.wait();
    loadMyDonations();
  } catch (err) {
    showError(parseContractError(err));
  }
}

async function confirmHandover(id) {
  try {
    const tx = await contract.confirmPickupByDonor(id);
    await tx.wait();
    alert("Handover confirmed. Waiting for NGO to confirm collection.");
    loadMyDonations();
  } catch (err) {
    showError(parseContractError(err));
  }
}

// Pulls the require()/revert message out of an ethers error object,
// since the raw error is verbose and hard to read.
function parseContractError(err) {
  const reason = err?.reason || err?.shortMessage || err?.message || "Transaction failed";
  return reason;
}
