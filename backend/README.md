# Zentigrity Backend - MongoDB/Node.js Implementation

A decentralized AI-powered grievance redressal platform backend built with Node.js, Express, MongoDB, and blockchain integration.

## Features

- **Grievance Management**: Submit, classify, and track community grievances
- **AI Classification**: Automatic categorization and priority assignment using OpenAI
- **Worker Bidding System**: Transparent marketplace for task assignments
- **DAO Governance**: Decentralized voting for bid selection and dispute resolution
- **Blockchain Integration**: Avalanche blockchain for transparency and escrow
- **Task Verification**: AI-powered image verification for completed work
- **User Management**: Wallet-based authentication with MetaMask

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Blockchain**: Avalanche (Ethers.js)
- **AI**: OpenAI GPT-4 Vision API
- **Authentication**: JWT + Wallet signature verification
- **Security**: Helmet, CORS, Rate limiting

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- MongoDB running locally or MongoDB Atlas
- OpenAI API key
- Avalanche testnet RPC access (optional for development)

### Installation

1. Clone and navigate to backend:
```bash
cd zenti-civic/backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

The server will start on `http://localhost:5000`

## Environment Variables

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/zentigrity
MONGODB_URI_TEST=mongodb://localhost:27017/zentigrity_test

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Blockchain Configuration (Avalanche)
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_CHAIN_ID=43113
DAO_WALLET_PRIVATE_KEY=your_dao_wallet_private_key_here
ESCROW_CONTRACT_ADDRESS=your_escrow_contract_address_here

# JWT Configuration
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Endpoints

### Authentication
- `POST /api/users/auth` - Authenticate with wallet signature
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Grievances
- `GET /api/grievances` - Get all grievances (with filters)
- `GET /api/grievances/marketplace` - Get marketplace grievances
- `POST /api/grievances` - Submit new grievance (Citizens only)
- `GET /api/grievances/:id` - Get specific grievance
- `PUT /api/grievances/:id` - Update grievance (Owner only)

### Worker Bids
- `GET /api/bids` - Get all bids
- `POST /api/bids` - Submit bid (Workers only)
- `GET /api/bids/grievance/:grievanceId` - Get bids for grievance
- `GET /api/bids/worker/:walletAddress` - Get worker's bids

### DAO Governance
- `GET /api/dao/votes` - Get all DAO votes
- `GET /api/dao/votes/active` - Get active votes
- `POST /api/dao/votes/:id/vote` - Submit vote (DAO members only)
- `POST /api/dao/assign-bid` - Manual bid assignment (DAO only)
- `GET /api/dao/dashboard` - DAO dashboard stats

### AI Services
- `POST /api/ai/classify/:grievanceId` - Trigger AI classification
- `POST /api/ai/verify-task/:assignmentId` - AI task verification
- `POST /api/ai/analyze-image` - General image analysis

### Blockchain
- `GET /api/blockchain/status` - Network status
- `GET /api/blockchain/transaction/:txHash` - Transaction details
- `POST /api/blockchain/escrow/:assignmentId/release` - Release escrow

## Workflow According to PRD

### 1. Citizen Grievance Submission
1. User connects MetaMask wallet
2. Submits grievance with description, category, location, optional image
3. Backend stores in MongoDB and triggers:
   - AI classification (async)
   - Blockchain transaction creation (async)
4. Grievance status updated to 'active'

### 2. AI Classification & Tagging
1. OpenAI analyzes grievance text and images
2. Assigns category and priority level
3. Adds suggested tags and confidence score
4. Updates grievance in MongoDB with classification

### 3. Worker Marketplace & Bidding
1. Workers browse active grievances
2. Submit bids with amount, timeline, and proposal
3. System tracks multiple bids per grievance
4. Auto-assignment for single urgent bids

### 4. DAO Voting & Assignment
1. Multiple bids trigger DAO vote creation
2. DAO members vote on best bid
3. Winning bid automatically assigned to worker
4. Escrow contract created on Avalanche

### 5. Task Completion & Verification
1. Worker completes task and uploads proof
2. AI analyzes completion images
3. Citizen and/or DAO verify completion
4. Escrow payment released to worker

## Database Schema

### Collections
- `grievances` - Community issues and problems
- `users` - Citizens, workers, and DAO members
- `workerbids` - Bids submitted by workers
- `taskassignments` - Assigned tasks and progress
- `daovotes` - DAO governance votes

### Key Relationships
- Grievances have many WorkerBids
- Grievances have one TaskAssignment (when assigned)
- TaskAssignments reference WorkerBids and Grievances
- DAOVotes reference Grievances and Bids for voting

## Development

### Project Structure
```
src/
├── models/           # MongoDB schemas
├── routes/           # API endpoints
├── services/         # Business logic (AI, blockchain)
├── middleware/       # Auth, error handling, validation
├── utils/           # Helper functions
├── config/          # Database connection
└── server.js        # Express app setup
```

### Testing

```bash
npm test
```

### Code Style

This project follows JavaScript Standard Style. Run linting:

```bash
npm run lint
```

## Deployment

### Production Setup

1. Use MongoDB Atlas for database
2. Set `NODE_ENV=production`
3. Configure proper CORS origins
4. Use environment variables for all secrets
5. Enable HTTPS
6. Configure proper logging

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## Security Considerations

- Wallet signature verification for authentication
- Rate limiting per IP and per user
- Input validation and sanitization
- CORS configuration
- Helmet for security headers
- No sensitive data in client responses

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Ensure all environment variables are documented

## License

MIT License - see LICENSE file for details.