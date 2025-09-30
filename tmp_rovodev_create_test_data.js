// Script to create test grievance and bid data for testing assignment
import mongoose from 'mongoose';
import Grievance from './backend/src/models/Grievance.js';
import WorkerBid from './backend/src/models/WorkerBid.js';
import User from './backend/src/models/User.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zentigrity';

async function createTestData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Your wallet address (replace with actual)
    const testWalletAddress = '0xff85a4c7082c12251c80fdf4b7f46ca04e6c43d9';

    // 1. Create a test grievance
    console.log('\n📋 Creating test grievance...');
    const testGrievance = new Grievance({
      title: 'Test Grievance for Assignment Testing',
      description: 'This is a test grievance created for testing the bid assignment process.',
      category: 'infrastructure',
      priority: 'medium',
      location: 'Test City, Test State',
      estimated_cost: 500,
      citizen_id: testWalletAddress,
      status: 'open', // Important: must be open to receive bids
      evidence: ['test-evidence.jpg'],
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456'
      },
      submission_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
    });

    const savedGrievance = await testGrievance.save();
    console.log('✅ Test grievance created:', savedGrievance._id);

    // 2. Create a test worker user (if doesn't exist)
    console.log('\n👷 Creating test worker...');
    let testWorker = await User.findByWallet(testWalletAddress);
    if (!testWorker) {
      testWorker = new User({
        wallet_address: testWalletAddress,
        user_types: ['citizen', 'worker', 'dao'], // All roles for testing
        primary_role: 'worker',
        display_name: 'Test Worker',
        reputation: { score: 85 },
        profile: {
          skills: [
            { name: 'Road Repair', level: 'expert' },
            { name: 'Infrastructure', level: 'intermediate' }
          ],
          dao_role: 'member', // Important: DAO role for assignment permissions
          voting_power: 5
        }
      });
      await testWorker.save();
      console.log('✅ Test worker created');
    } else {
      // Update existing user to have all roles
      if (!testWorker.user_types.includes('worker')) {
        testWorker.user_types.push('worker');
      }
      if (!testWorker.user_types.includes('dao')) {
        testWorker.user_types.push('dao');
      }
      if (!testWorker.profile) testWorker.profile = {};
      testWorker.profile.dao_role = 'member';
      testWorker.profile.voting_power = 5;
      await testWorker.save();
      console.log('✅ Test worker updated with all roles');
    }

    // 3. Create a test bid
    console.log('\n💰 Creating test bid...');
    const testBid = new WorkerBid({
      grievance_id: savedGrievance._id,
      worker_id: testWalletAddress,
      bid_amount: 450,
      proposal: 'I can fix this issue efficiently within the estimated timeline. I have experience with similar infrastructure problems.',
      estimated_completion_time: 48, // 48 hours
      skills_offered: ['Road Repair', 'Infrastructure', 'Quality Assurance'],
      status: 'pending',
      worker_reputation: 85
    });

    const savedBid = await testBid.save();
    console.log('✅ Test bid created:', savedBid._id);

    // 4. Create another competing bid for testing
    console.log('\n💰 Creating competing test bid...');
    const competingBid = new WorkerBid({
      grievance_id: savedGrievance._id,
      worker_id: testWalletAddress, // Same worker for testing
      bid_amount: 520,
      proposal: 'Alternative approach with premium materials and faster delivery.',
      estimated_completion_time: 36, // 36 hours
      skills_offered: ['Road Repair', 'Premium Materials', 'Fast Delivery'],
      status: 'pending',
      worker_reputation: 85
    });

    const savedCompetingBid = await competingBid.save();
    console.log('✅ Competing test bid created:', savedCompetingBid._id);

    console.log('\n🎉 ===== TEST DATA CREATED SUCCESSFULLY =====');
    console.log('📋 Test Grievance ID:', savedGrievance._id);
    console.log('💰 Test Bid 1 ID:', savedBid._id);
    console.log('💰 Test Bid 2 ID:', savedCompetingBid._id);
    console.log('👤 Worker/DAO Address:', testWalletAddress);
    
    console.log('\n🧪 ===== TESTING INSTRUCTIONS =====');
    console.log('1. Go to http://localhost:8082/dao/bids');
    console.log('2. Look for the test grievance: "Test Grievance for Assignment Testing"');
    console.log('3. Click "Assign Work" on one of the test bids');
    console.log('4. Watch console for detailed transaction logs');
    console.log('5. Check if MetaMask popup appears');
    
    console.log('\n📊 ===== TEST DATA SUMMARY =====');
    console.log('- Grievance Status: open (can receive bids)');
    console.log('- Bid Status: pending (can be assigned)');
    console.log('- User Roles: citizen, worker, dao');
    console.log('- DAO Role: member');
    console.log('- Voting Power: 5');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

createTestData();