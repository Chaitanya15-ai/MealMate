// If MetaMask is available, use it (read-only calls work even without
// connecting). Otherwise fall back to a public RPC so this page truly
// works for any visitor, MetaMask or not.
const PUBLIC_RPC_URL = "http://127.0.0.1:8545"; // swap for your Sepolia RPC when deployed there

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("verify-btn").addEventListener("click", verifyFoodId);

  const params = new URLSearchParams(window.location.search);
  const idFromUrl = params.get("id");
  if (idFromUrl) {
    document.getElementById("food-id-input").value = idFromUrl;
    verifyFoodId();
  }

  // Connect wallet in the background just to show the wallet status pill;
  // verification itself doesn't require it.
  if (typeof window.ethereum !== "undefined") {
    connectWallet();
  }
});

async function getContractForRead() {
  if (typeof window.ethereum !== "undefined") {
    const p = new ethers.BrowserProvider(window.ethereum);
    return new ethers.Contract(CONTRACT_ADDRESS, FOOD_DONATION_ABI, p);
  }
  return getReadOnlyContract(PUBLIC_RPC_URL);
}

async function verifyFoodId() {
  const id = document.getElementById("food-id-input").value;
  if (!id) return showError("Enter a Food ID.");

  const card = document.getElementById("passport-card");
  const detailsEl = document.getElementById("passport-details");
  const timelineEl = document.getElementById("passport-timeline");

  try {
    const readContract = await getContractForRead();
    const d = await readContract.getDonation(id);

    card.style.display = "block";
    document.getElementById("passport-id").textContent = "FD" + d.id.toString().padStart(3, "0");

    const risk = expiryRisk(d.expiryTime, Number(d.status));

    detailsEl.innerHTML = `
      <p><strong>Food:</strong> ${d.foodName} (${d.category})</p>
      <p><strong>Quantity:</strong> ${d.quantity} ${d.unit}</p>
      <p><strong>Donor wallet:</strong> ${d.donor}</p>
      <p><strong>NGO wallet:</strong> ${d.ngo === ethers.ZeroAddress ? "Not yet assigned" : d.ngo}</p>
      <p><strong>Pickup location:</strong> ${d.pickupLocation}</p>
      <p><strong>Expiry:</strong> ${formatTimestamp(d.expiryTime)} <span class="badge ${risk.css}">${risk.label}</span></p>
      <p><strong>Status:</strong> <span class="badge ${statusBadgeClass(Number(d.status))}">${STATUS_LABELS[Number(d.status)]}</span></p>
      ${
        Number(d.status) === 3
          ? `<p><strong>Distributed to:</strong> ${d.recipientGroup} (${d.peopleServed} people served)</p>`
          : ""
      }
    `;

    const steps = [
      { label: "Donation Created", done: true, time: d.createdAt },
      { label: "Accepted by NGO", done: Number(d.status) >= 1 && d.ngo !== ethers.ZeroAddress, time: d.acceptedAt },
      { label: "Donor confirmed handover", done: d.donorConfirmedHandover, time: null },
      { label: "NGO confirmed collection", done: d.ngoConfirmedCollection, time: null },
      { label: "Collected", done: Number(d.status) >= 2, time: d.collectedAt },
      { label: "Distributed", done: Number(d.status) === 3, time: d.distributedAt },
    ];

    timelineEl.innerHTML = steps
      .map(
        (s) => `
        <li class="${s.done ? "done" : ""}">
          ${s.done ? "✓" : "○"} ${s.label}
          ${s.done && s.time && Number(s.time) > 0 ? `<div class="meta">${formatTimestamp(s.time)}</div>` : ""}
        </li>`
      )
      .join("");

    renderQr(id);
  } catch (err) {
    card.style.display = "none";
    showError("Could not find that Food ID on-chain: " + (err.reason || err.message || err));
  }
}

function statusBadgeClass(statusIndex) {
  if (statusIndex === 3) return "risk-green"; // DISTRIBUTED
  if (statusIndex === 4 || statusIndex === 5) return "risk-red"; // EXPIRED / CANCELLED
  return "risk-yellow";
}

let qrInstance = null;
function renderQr(id) {
  const el = document.getElementById("qr-canvas");
  el.innerHTML = "";
  const url = window.location.origin + window.location.pathname + "?id=" + id;
  qrInstance = new QRCode(el, {
    text: url,
    width: 160,
    height: 160,
  });
}
