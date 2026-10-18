# MealMate – Smart Food Donation & Expiry Tracker

Reduce Food Waste. Track Every Donation. Verify Every Transaction.

## About the Project

MealMate is a blockchain-based food donation platform designed to connect food donors, NGOs, and recipients. It helps manage food donations, track expiry dates, and improve transparency using smart contracts.

The project aims to reduce food wastage and ensure that donated food can be tracked throughout the donation and distribution process.

## Features

- Food donation management
- Donor and NGO interfaces
- Food expiry tracking
- Blockchain-based donation records
- Smart contract verification
- Donation status tracking
- Transparent and traceable transactions

## Technologies Used

- Solidity – Smart contract development
- Hardhat – Smart contract development and testing
- JavaScript – Application functionality
- HTML and CSS – Frontend interface
- Ethers.js – Blockchain interaction
- MetaMask – Wallet connection
- Local Ethereum network – Development and testing

## Project Structure

```text
MealMate/
├── contracts/
├── frontend/
│   ├── index.html
│   ├── donor.html
│   ├── ngo.html
│   └── verify.html
├── scripts/
├── test/
├── .env.example
├── .gitignore
├── hardhat.config.js
├── package.json
└── README.md
```

## Prerequisites

- Node.js and npm
- MetaMask browser extension
- A code editor such as Visual Studio Code

## Installation and Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/MealMate-Smart-Food-Donation.git
   ```

2. Navigate to the project directory:

   ```bash
   cd MealMate-Smart-Food-Donation
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the local blockchain:

   ```bash
   npx hardhat node
   ```

5. In a separate terminal, deploy the smart contract using the deployment script provided in the project. For example:

   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```

6. Configure the deployed contract address and connect MetaMask to the local development network.

7. Start the frontend using your preferred local server, such as the VS Code Live Server extension.

## How It Works

1. Donors submit food donation details.
2. NGOs review and accept available donations.
3. Food expiry information helps users monitor donation suitability.
4. Smart contracts record relevant donation transactions.
5. Users can verify donation details and track their status.

## Future Scope

- Integration with real NGOs and food banks
- Automated expiry notifications
- Improved recipient verification
- Deployment on a public blockchain testnet
- Enhanced dashboards and reporting

## Disclaimer

This project is developed for educational and demonstration purposes. The local blockchain configuration is intended for development and testing.

## Author

Developed as an academic blockchain project.

