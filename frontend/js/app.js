// Shared helpers used by every page: wallet connection + contract instance.

let provider;
let signer;
let contract;
let currentAccount;

async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    alert("MetaMask is not installed. Please install it from https://metamask.io");
    return null;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    currentAccount = accounts[0];

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== EXPECTED_CHAIN_ID) {
      console.warn(
        `Connected to chain ${network.chainId}, expected ${EXPECTED_CHAIN_ID}. ` +
          `Switch networks in MetaMask if transactions fail.`
      );
    }

    contract = new ethers.Contract(CONTRACT_ADDRESS, FOOD_DONATION_ABI, signer);

    updateWalletUI(currentAccount);

    // Refresh the page state if the user switches accounts in MetaMask.
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());

    return { provider, signer, contract, account: currentAccount };
  } catch (err) {
    console.error("Wallet connection failed:", err);
    alert("Could not connect wallet: " + (err.message || err));
    return null;
  }
}

function updateWalletUI(account) {
  const el = document.getElementById("wallet-status");
  if (!el) return;
  if (account) {
    el.textContent = "Connected: " + account.slice(0, 6) + "..." + account.slice(-4);
    el.classList.add("connected");
  } else {
    el.textContent = "Not connected";
    el.classList.remove("connected");
  }
}

// A read-only contract instance, useful for the public verify page
// where the visitor may not have MetaMask installed at all.
function getReadOnlyContract(rpcUrl) {
  const readProvider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(CONTRACT_ADDRESS, FOOD_DONATION_ABI, readProvider);
}

function formatTimestamp(unixSeconds) {
  const n = Number(unixSeconds);
  if (!n) return "-";
  return new Date(n * 1000).toLocaleString();
}

function expiryRisk(expiryUnixSeconds, statusIndex) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = Number(expiryUnixSeconds);

  if (statusIndex === 4) return { label: "EXPIRED", css: "risk-red" };
  if (expiry <= now) return { label: "EXPIRED", css: "risk-red" };

  const hoursLeft = (expiry - now) / 3600;
  if (hoursLeft > 24) return { label: "SAFE", css: "risk-green" };
  return { label: "EXPIRING SOON", css: "risk-yellow" };
}

function showError(message) {
  console.error(message);
  alert(message);
}
