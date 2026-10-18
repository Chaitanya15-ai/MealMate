# Smart Food Donation & Expiry Tracker (Ethereum DApp)

A blockchain-based food donation and expiry-tracking system. Donors list
surplus food, approved NGOs accept it before it expires (enforced by the
smart contract), both sides confirm pickup on-chain, and every donation
gets a public "Food Passport" you can verify with a QR code.

This README walks you through everything from a blank machine to a
working local demo, then optionally deploying to the Sepolia public
testnet.

---

## 0. What you're installing

| Tool | What it's for |
|---|---|
| Node.js | Runs Hardhat and the project's JavaScript |
| Hardhat | Compiles, tests, and deploys the Solidity smart contract; also runs a local Ethereum blockchain |
| MetaMask | Browser wallet extension, used to sign transactions |
| VS Code (optional) | Code editor |

Everything is free. No real ETH is needed for local development.

---

## 1. Install prerequisites

1. **Node.js** (v18 or newer): download from https://nodejs.org (LTS version).
   Verify install:
   ```bash
   node -v
   npm -v
   ```
2. **MetaMask**: install the browser extension from https://metamask.io
   for Chrome/Firefox/Edge/Brave. Create a wallet and **save your seed
   phrase somewhere safe** — for a local test wallet this doesn't need to
   be highly secure, but don't reuse a wallet that holds real funds.
3. **Git** (optional, if you want version control): https://git-scm.com
4. **VS Code** (optional): https://code.visualstudio.com

---

## 2. Get the project and install dependencies

Unzip the project folder you downloaded, then in a terminal:

```bash
cd smart-food-donation
npm install
```

This installs Hardhat, the Hardhat Toolbox (ethers.js, Chai, Mocha, test
helpers), and dotenv.

---

## 3. Compile the smart contract

```bash
npm run compile
```

You should see `Compiled 1 Solidity file successfully`. The contract is
at `contracts/FoodDonation.sol`.

> Note: the contract uses `viaIR: true` in `hardhat.config.js`. This is
> required because `getDonation()` returns a large struct that otherwise
> triggers Solidity's "stack too deep" compiler error — don't remove it.

---

## 4. Run the automated tests

```bash
npm test
```

This runs `test/FoodDonation.js`, which exercises the full lifecycle and
the security rules from the project spec: registration, NGO approval,
expiry rejection, dual pickup confirmation, distribution, and prevention
of double-accepting or double-distributing a donation. All tests should
pass.

---

## 5. Run a local blockchain

Open a **new terminal tab** (keep it running) and start Hardhat's local
Ethereum network:

```bash
npm run node
```

This prints 20 test accounts, each pre-funded with 10,000 fake ETH, along
with their private keys. **Keep this terminal open** — this is your local
blockchain.

---

## 6. Deploy the contract locally

In your **original terminal**, pick one of the following:

**Option A — empty contract, you create everything yourself:**
```bash
npm run deploy:local
```

**Option B — deploy AND seed it with 6 sample donations** (Worli/Thane/Chembur
restaurants and NGOs, covering every status: available, expiring soon,
accepted, distributed, and expired), so there's something to look at right
away:
```bash
npm run seed:local
```
This deploys the contract, then runs real transactions to register 6 donor
organizations and 2 NGOs (each on a different Hardhat test account) and
create/advance their donations. It prints a wallet → organization table at
the end — import the matching private key from your `npm run node` terminal
into MetaMask if you want to browse the Donor or NGO page logged in "as" one
specific organization. Since each sample donation belongs to a different
wallet, the Donor page's "My donations" will only ever show the donations
owned by whichever wallet is currently connected — to see all 6 together
regardless of owner or status, use the new "Recent Donations" section on the
home page, which reads every donation straight from the contract.

Either way, it prints something like:

```
FoodDonation deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa
```

Copy that address.

---

## 7. Connect MetaMask to your local blockchain

1. Open MetaMask → click the network dropdown → **Add network** → **Add a network manually**.
2. Fill in:
   - Network name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`
3. Save, then switch MetaMask to this new network.
4. Import a couple of test accounts: MetaMask → Account menu → **Import account**
   → paste a private key from the `npm run node` terminal output. Import
   at least two accounts — you'll use one as the **Donor** and one as the
   **NGO**. The very first account (`Account #0`) is the contract **admin**
   (whoever ran the deploy script), which you'll need to approve NGOs.

---

## 8. Wire the frontend to your deployed contract

Open `frontend/js/config.js` and paste your deployed address:

```js
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa";
```

`EXPECTED_CHAIN_ID` is already set to `31337` for the local network.

---

## 9. Run the frontend

The frontend is plain HTML/CSS/JS — no build step. Serve it with any
static server, for example:

```bash
npx serve frontend -p 5500
```

Then open `http://localhost:5500` in your browser (the same browser
where MetaMask is installed).

> Don't just double-click `index.html` to open it as a `file://` URL —
> some browsers block wallet connections and fetch requests on `file://`
> pages. Always serve it over `http://localhost`.

---

## 10. Walk through the demo

1. **Home page** → Connect Wallet (use your Donor account).
2. **Donor page** → Register as Donor → fill in the donation form (set
   the expiry a few minutes in the future so you can test rejection
   easily) → Register Donation. Approve the MetaMask transaction popup.
3. Switch MetaMask to your **NGO account** → go to **NGO page** →
   Register as NGO.
4. Switch MetaMask back to your **admin account** (Account #0) → NGO
   page → the "Admin: approve an NGO" panel appears → paste the NGO's
   address → Approve NGO.
5. Switch to the **NGO account** again → refresh → Accept the donation
   under "Available donations".
6. Switch to the **Donor account** → on the Donor page, click
   **Confirm Handover** on that donation.
7. Switch to the **NGO account** → on the NGO page, click
   **Confirm Collection** under "My accepted donations". Status moves to
   `COLLECTED` only once both sides have confirmed.
8. Still as NGO → fill in "Distribute food" with the Food ID, a
   recipient group name, and people served → Mark Distributed.
9. Go to the **Verify page**, enter the Food ID, and see the full
   on-chain timeline plus a scannable QR code (the "Food Passport").
10. **Expiry demo**: create a new donation with an expiry 1 minute in
    the future, wait a minute, then try to Accept it as the NGO — the
    transaction will revert with `Food has expired`. This is the
    strongest demonstration of why the rules live in the smart contract
    and not just the frontend.

---

## 11. (Optional) Deploy to the Sepolia public testnet

Only do this once the local flow works end-to-end.

1. Get a free RPC URL from https://infura.io or https://alchemy.com —
   create a project, select the Sepolia network, and copy the HTTPS URL.
2. Get free Sepolia test ETH from a faucet, e.g.
   https://sepoliafaucet.com or https://www.alchemy.com/faucets/ethereum-sepolia
   (send it to your MetaMask address).
3. Copy `.env.example` to `.env` and fill in:
   ```
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your-project-id
   PRIVATE_KEY=your-test-wallet-private-key
   ```
   **Never commit `.env` or share this private key** — use a wallet that
   only holds test funds.
4. Deploy:
   ```bash
   npm run deploy:sepolia
   ```
5. Update `frontend/js/config.js`:
   ```js
   const CONTRACT_ADDRESS = "0xYourSepoliaContractAddress";
   const EXPECTED_CHAIN_ID = 11155111;
   ```
6. In MetaMask, switch to the Sepolia network (built in, just enable it
   under Settings → Advanced → Show test networks).
7. In `frontend/js/verify.js`, update `PUBLIC_RPC_URL` to your Sepolia
   RPC URL so the Verify page works even for visitors without MetaMask.

Do **not** deploy to Ethereum mainnet for a college project — there's no
reason to spend real ETH on this.

---

## Project structure

```
smart-food-donation/
├── contracts/
│   └── FoodDonation.sol       # the smart contract
├── scripts/
│   └── deploy.js              # deployment script
├── test/
│   └── FoodDonation.js        # automated tests (registration, expiry, lifecycle, security rules)
├── frontend/
│   ├── index.html
│   ├── donor.html
│   ├── ngo.html
│   ├── verify.html            # public Food Passport verification + QR
│   ├── css/style.css
│   └── js/
│       ├── config.js          # <- put your deployed contract address here
│       ├── abi.js             # auto-generated contract ABI
│       ├── app.js             # shared wallet connection logic
│       ├── donor.js
│       ├── ngo.js
│       └── verify.js
├── hardhat.config.js
├── package.json
└── .env.example
```

## What's on-chain vs off-chain

**On-chain (in the smart contract):** donor/NGO wallet addresses,
registration and NGO-approval status, every donation's ID, food name,
category, quantity, preparation/expiry timestamps, pickup location,
status, timestamps for each lifecycle step, dual-confirmation flags,
and the final recipient group / people-served figures.

**Off-chain (kept out of the contract on purpose):** donor/NGO
organization name and location, and food photos (wire up IPFS if you
want this — the `imageCID` field is already there). Org profile data
is currently stored in the browser's `localStorage`, keyed by wallet
address (see `frontend/js/profile.js`) — a real deployment would swap
this for a small backend/database so a profile follows the user across
browsers and devices, but for a self-contained frontend-only demo this
keeps the on-chain/off-chain split real without needing a server.

## Admin controls

The wallet that deploys the contract becomes `admin`. From the NGO
page's admin panel, that wallet can:
- **Approve NGO** — required before an NGO can accept any donation.
- **Revoke NGO** — pulls approval from an NGO that's misbehaving. It
  doesn't undo donations already in progress, it just blocks that NGO
  from accepting new ones until re-approved.
- **Transfer Admin** — hands control to a different wallet. Do this if
  you're worried about losing the original deploy wallet's key, or
  handing the project off to someone else. There's no way to recover
  admin rights if the current admin wallet's key is lost and this was
  never used, so treat it as a one-way door.

## Feature scope in this build

Implemented (Level 1 + Level 2 from the original plan, plus a few
security hardening additions):
wallet-based identity, donor registration, NGO registration + admin
approval/revocation, admin transfer, food donation registration with a
unique Food ID, expiry timestamp + on-chain expiry rejection, expiry
risk badges (🟢🟡🔴), expiry-priority sorting for NGOs, NGO acceptance,
dual pickup confirmation, distribution + impact fields (recipient
group, people served), immutable on-chain history, QR Food Passport,
and public blockchain verification (works without MetaMask).

Not implemented here, left as extensions if you want to go further:
donor/NGO reputation scoring, badges, PDF donation certificates, IPFS
image upload wiring, and an admin analytics dashboard — the contract's
view functions (`getAllDonationIds`, `totalDonations`, etc.) already
give you everything you'd need to build these on the frontend.
