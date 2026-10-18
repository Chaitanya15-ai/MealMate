// A public, read-only feed of every donation the contract has ever seen -
// regardless of status or which wallet owns it. Works with or without
// MetaMask, same approach as verify.js, since it only ever calls view
// functions (no transactions, so no signer needed).

const BROWSE_PUBLIC_RPC_URL = "http://127.0.0.1:8545"; // swap for your Sepolia RPC once deployed there

document.addEventListener("DOMContentLoaded", () => {
  loadAllDonations();
});

async function getBrowseContract() {
  if (typeof window.ethereum !== "undefined") {
    const p = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(CONTRACT_ADDRESS, FOOD_DONATION_ABI, p);
  }
  return getReadOnlyContract(BROWSE_PUBLIC_RPC_URL);
}

async function loadAllDonations() {
  const el = document.getElementById("all-donations-list");
  if (!el) return;

  try {
    const readContract = await getBrowseContract();
    const ids = await readContract.getAllDonationIds();

    if (ids.length === 0) {
      el.innerHTML = "<p class='hint'>No donations on-chain yet.</p>";
      return;
    }

    const donations = await Promise.all(ids.map((id) => readContract.getDonation(id)));
    el.innerHTML = "";

    donations
      .slice()
      .reverse()
      .forEach((d) => {
        const item = document.createElement("div");
        item.className = "donation-item";
        item.innerHTML = `
          <div>
            <strong>FD${d.id.toString().padStart(3, "0")}</strong> — ${d.foodName} (${d.quantity} ${d.unit})
            <div class="meta">Pickup: ${d.pickupLocation}</div>
            <div class="meta">Donor: ${d.donor.slice(0, 6)}...${d.donor.slice(-4)}${
          d.ngo !== ethers.ZeroAddress ? " · NGO: " + d.ngo.slice(0, 6) + "..." + d.ngo.slice(-4) : ""
        }</div>
          </div>
          <div>
            <span class="badge ${statusBadgeClass(Number(d.status))}">${STATUS_LABELS[Number(d.status)]}</span>
            <a href="verify.html?id=${d.id}" class="btn secondary" style="margin-left:8px; text-decoration:none;">View Passport</a>
          </div>
        `;
        el.appendChild(item);
      });
  } catch (err) {
    console.error(err);
    el.innerHTML = "<p class='hint'>Could not load donations from the contract. Check CONTRACT_ADDRESS in config.js and that your local node is running.</p>";
  }
}

function statusBadgeClass(statusIndex) {
  if (statusIndex === 3) return "risk-green"; // DISTRIBUTED
  if (statusIndex === 4 || statusIndex === 5) return "risk-red"; // EXPIRED / CANCELLED
  return "risk-yellow";
}
