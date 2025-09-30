# Zentigrity Deployment Checklist & Requirements

## 🏗️ **Smart Contracts to Deploy**

### **ONLY 1 Contract Needed: ZentSimple.sol**

The simplified architecture requires only **ONE smart contract** instead of the complex 6-contract system.

```solidity
// File: zenti-civic/contracts/contracts/ZentSimple.sol
contract ZentSimple {
    // Handles all 5 transaction types:
    // 1. submitGrievance(dataHash)
    // 2. submitBid(grievanceId, bidAmountINR)  
    // 3. assignTask(grievanceId, winningBidId) [payable]
    // 4. submitWorkComplete(grievanceId, proofHash)
    // 5. citizenConfirmCompletion(grievanceId) + daoConfirmCompletion(grievanceId)
}
```

## 📋 **Deployment Steps**

### **Step 1: Deploy Smart Contract**
```bash
cd zenti-civic/contracts

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add your deployer private key
echo "PRIVATE_KEY=your_wallet_private_key_here" >> .env

# Deploy to Avalanche testnet
npx hardhat run scripts/deploy-simple.js --network avalanche-testnet

# The script will output:
# ✅ ZentSimple deployed to: 0xABC123...
# 🔧 ADD THESE TO YOUR BACKEND .env FILE:
# ZENT_SIMPLE_ADDRESS=0xABC123...
```

### **Step 2: Get Contract ABI**
After deployment, the ABI is automatically generated:
```bash
# ABI will be in:
zenti-civic/contracts/artifacts/contracts/ZentSimple.sol/ZentSimple.json

# Extract just the ABI array from this file
```

## 🔑 **What You Need to Provide**

### **1. Smart Contract Deployment (YOU MUST DO)**

#### **Required Information:**
- **Deployer Wallet Private Key**: For deploying contract
- **Avalanche Testnet AVAX**: For gas fees (~0.1 AVAX needed)

#### **After Deployment, You'll Get:**
- **Contract Address**: `0xABC123...` (needed in backend)
- **Contract ABI**: JSON array (needed in backend)
- **Transaction Hash**: Deployment confirmation

### **2. Backend Environment Variables**

```env
# ===========================================
# REQUIRED (Project won't work without these)
# ===========================================

# AI Service
GEMINI_API_KEY=your_gemini_api_key_here                    # ⚠️ REQUIRED

# Database  
MONGODB_URI=mongodb://localhost:27017/zentigrity           # ⚠️ REQUIRED
# OR
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/   # ⚠️ REQUIRED

# Smart Contract (after deployment)
ZENT_SIMPLE_ADDRESS=0x...                                  # ⚠️ REQUIRED AFTER DEPLOYMENT

# ===========================================  
# OPTIONAL (Has defaults, but recommended)
# ===========================================

# Server
PORT=5000                                                   # Default: 5000
NODE_ENV=development                                        # Default: development

# JWT
JWT_SECRET=your_random_secret_here                          # Default: generates random

# Blockchain  
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc # Default: testnet
DAO_WALLET_PRIVATE_KEY=your_dao_wallet_private_key         # Optional: for auto transactions
AVAX_PRICE_INR=2500                                        # Default: 2500

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000                                # Default: 15 minutes  
RATE_LIMIT_MAX_REQUESTS=100                                # Default: 100 requests
```

### **3. Frontend Environment Variables**

```env
# ===========================================
# REQUIRED  
# ===========================================
VITE_API_BASE_URL=http://localhost:5000/api               # ⚠️ REQUIRED

# ===========================================
# OPTIONAL
# ===========================================
VITE_APP_NAME=Zentigrity                                  # Default: Zentigrity
VITE_ENABLE_DEVTOOLS=true                                 # Default: false
```

## 🔧 **Where Contract Info is Used**

### **Backend Integration Points:**

#### **1. Blockchain Service (`backend/src/services/blockchainService.js`)**
```javascript
// Contract address needed here:
const zentSimple = new ethers.Contract(
  process.env.ZENT_SIMPLE_ADDRESS,  // ⚠️ FROM DEPLOYMENT
  ZENT_SIMPLE_ABI,                  // ⚠️ FROM CONTRACT COMPILATION  
  daoWallet
);
```

#### **2. ABI Definition (HARDCODED - needs update after deployment)**
```javascript
// Currently hardcoded in blockchainService.js
const ZENT_SIMPLE_ABI = [
  "function submitGrievance(string memory _dataHash) external returns (uint256)",
  "function submitBid(uint256 _grievanceId, uint256 _bidAmountINR) external returns (uint256)",
  // ... rest of ABI
];
```

**❌ CURRENT ISSUE:** ABI is hardcoded and may not match deployed contract exactly.

**✅ SOLUTION:** After deployment, update ABI from compiled artifacts.

## 🚨 **Critical Post-Deployment Steps**

### **Step 1: Update Backend with Contract Info**
```bash
# After contract deployment, add to backend/.env:
echo "ZENT_SIMPLE_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS" >> backend/.env
```

### **Step 2: Update ABI in Backend**
```bash
# Copy ABI from compilation artifacts:
cp contracts/artifacts/contracts/ZentSimple.sol/ZentSimple.json backend/src/contracts/

# Update blockchainService.js to import ABI:
```

### **Step 3: Verify Contract Integration**
```bash
# Test blockchain connection:
cd backend
npm run dev

# In logs, look for:
# ✅ Blockchain configured: true
# ✅ Contract address: 0x...
# ❌ Contract not found (if ABI/address wrong)
```

## 📁 **File Locations That Need Updates**

### **After Smart Contract Deployment:**

#### **1. Backend Blockchain Service**
```
File: zenti-civic/backend/src/services/blockchainService.js
Line: ~15-30 (ZENT_SIMPLE_ABI constant)
Update: Replace hardcoded ABI with actual deployed contract ABI
```

#### **2. Backend Environment**  
```
File: zenti-civic/backend/.env
Add: ZENT_SIMPLE_ADDRESS=0x...
```

#### **3. Frontend API Service (Optional)**
```
File: zenti-civic/zest-civic/src/services/api.ts
No changes needed - uses backend API, not direct contract calls
```

## 🔍 **How to Get Contract ABI**

### **Method 1: From Compilation Artifacts (Recommended)**
```bash
# After running deploy-simple.js:
cd zenti-civic/contracts
cat artifacts/contracts/ZentSimple.sol/ZentSimple.json | jq '.abi' > ZentSimple_ABI.json
```

### **Method 2: From Hardhat**
```bash
# Generate ABI:
npx hardhat compile
# ABI will be in artifacts/contracts/ZentSimple.sol/ZentSimple.json
```

### **Method 3: From Deployed Contract (if verified)**
```bash
# If contract is verified on SnowTrace:
# Go to: https://testnet.snowtrace.io/address/YOUR_CONTRACT_ADDRESS
# Copy ABI from "Contract" tab
```

## 🧪 **Testing Deployment**

### **Test Contract Deployment:**
```bash
# 1. Check contract exists on Avalanche:
curl -X POST https://api.avax-test.network/ext/bc/C/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"eth_getCode", 
    "params":["YOUR_CONTRACT_ADDRESS", "latest"],
    "id":1
  }'

# Should return contract bytecode (not "0x")
```

### **Test Backend Integration:**
```bash
# 1. Start backend:
cd backend && npm run dev

# 2. Check health endpoint:
curl http://localhost:5000/health

# 3. Check blockchain status:
curl http://localhost:5000/api/blockchain/status
```

### **Test Contract Function Calls:**
```bash
# Test conversion function (read-only):
curl -X GET "http://localhost:5000/api/conversion/inr-to-avax?amount=100"
```

## 💡 **Pro Tips**

### **1. Save Deployment Info**
The deploy script automatically saves deployment info to:
```
zenti-civic/contracts/deployments/simple_avalanche-testnet_deployment.json
```

### **2. Verify Contract (Optional but Recommended)**
```bash
# After deployment:
npx hardhat verify --network avalanche-testnet YOUR_CONTRACT_ADDRESS "FEE_COLLECTOR_ADDRESS"
```

### **3. Fund DAO Wallet**
```bash
# The DAO wallet needs AVAX for:
# - Creating escrows (task assignments)  
# - Releasing payments
# - Updating AVAX price

# Fund with at least 5-10 AVAX for testing
```

## 🚀 **Quick Start Command**

```bash
# Complete deployment and setup:

# 1. Deploy contract
cd zenti-civic/contracts
npm install
echo "PRIVATE_KEY=your_private_key" > .env
npx hardhat run scripts/deploy-simple.js --network avalanche-testnet

# 2. Update backend
cd ../backend  
echo "ZENT_SIMPLE_ADDRESS=0xYOUR_CONTRACT_FROM_STEP1" >> .env
echo "GEMINI_API_KEY=your_gemini_key" >> .env
echo "MONGODB_URI=your_mongodb_uri" >> .env

# 3. Start services
npm run dev

# 4. Start frontend (new terminal)
cd ../zest-civic
npm run dev
```

## ❓ **What You Need From Me**

After you deploy the contract, please provide:

1. **Contract Address**: `0x...` (from deployment output)
2. **Any deployment errors**: If deployment fails
3. **Confirmation of environment variables**: GEMINI_API_KEY and MONGODB_URI set

I can then:
- Update the ABI in the backend if needed
- Help debug any integration issues  
- Test the complete end-to-end workflow
- Help with contract verification if needed

The system is designed to work with just **ONE contract deployment** and **three environment variables**! 🎯