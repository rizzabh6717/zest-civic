// Console script to unassign your most recent assignment
// Copy and paste this into browser console (F12 → Console) on any page with localhost:8082

(async function unassignRecentTask() {
    const API_BASE = 'http://localhost:5000/api';
    
    console.log('🚀 ===== UNASSIGN RECENT TASK SCRIPT =====');
    
    try {
        // Step 1: Authenticate
        console.log('🔐 Step 1: Authenticating...');
        const authData = {
            walletAddress: '0xff85a4c7082c12251c80fdf4b7f46ca04e6c43d9', // Replace with your wallet
            signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
            message: `Sign this message to authenticate with Zentigrity.\n\nWallet: 0xff85a4c7082c12251c80fdf4b7f46ca04e6c43d9\nUser Type: dao\nTimestamp: ${new Date().toISOString()}`,
            timestamp: new Date().toISOString(),
            userType: 'dao'
        };

        const authResponse = await fetch(`${API_BASE}/users/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(authData)
        });

        if (!authResponse.ok) {
            throw new Error(`Auth failed: ${authResponse.status}`);
        }

        const authResult = await authResponse.json();
        const token = authResult.data.token;
        console.log('✅ Authentication successful');

        // Step 2: Get recent assignments
        console.log('📋 Step 2: Fetching recent assignments...');
        
        // Try multiple endpoints to find assignments
        const endpoints = [
            '/task-assignments',
            '/assignments',
            '/dao/assignments',
            '/worker/assignments'
        ];
        
        let assignments = [];
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${API_BASE}${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    assignments = data.data || data.assignments || data || [];
                    console.log(`✅ Found ${assignments.length} assignments from ${endpoint}`);
                    break;
                }
            } catch (err) {
                console.log(`❌ ${endpoint} failed: ${err.message}`);
            }
        }

        if (assignments.length === 0) {
            console.log('❌ No assignments found');
            return;
        }

        // Step 3: Find most recent assignment
        console.log('🔍 Step 3: Finding most recent assignment...');
        
        // Sort by creation date (most recent first)
        assignments.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
        
        const recentAssignment = assignments[0];
        console.log('📋 Most recent assignment found:');
        console.log('  - Assignment ID:', recentAssignment._id);
        console.log('  - Grievance ID:', recentAssignment.grievance_id);
        console.log('  - Worker ID:', recentAssignment.worker_id);
        console.log('  - Status:', recentAssignment.status);
        console.log('  - Escrow Amount:', recentAssignment.escrow_amount);
        console.log('  - Created:', recentAssignment.createdAt || recentAssignment.created_at);

        if (recentAssignment.status === 'completed') {
            console.log('❌ Cannot unassign completed task');
            return;
        }

        if (recentAssignment.status === 'unassigned') {
            console.log('❌ Task is already unassigned');
            return;
        }

        // Step 4: Unassign the task
        console.log('🔄 Step 4: Unassigning task...');
        
        const unassignResponse = await fetch(`${API_BASE}/dao/unassign-task`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                assignment_id: recentAssignment._id,
                reason: 'Unassigned via console script for testing'
            })
        });

        if (!unassignResponse.ok) {
            const errorText = await unassignResponse.text();
            throw new Error(`Unassign failed: ${unassignResponse.status} - ${errorText}`);
        }

        const unassignResult = await unassignResponse.json();
        
        console.log('🎉 ===== UNASSIGNMENT SUCCESSFUL =====');
        console.log('✅ Task unassigned successfully!');
        console.log('📊 Results:');
        console.log('  - Assignment ID:', unassignResult.data.assignment_id);
        console.log('  - Grievance ID:', unassignResult.data.grievance_id);
        console.log('  - Worker ID:', unassignResult.data.worker_id);
        console.log('  - New Grievance Status:', unassignResult.data.grievance_status);
        console.log('  - Unassigned At:', unassignResult.data.unassigned_at);
        console.log('  - Transaction ID:', unassignResult.data.transaction.transaction_id);
        
        console.log('\n🔄 Task is now available for reassignment!');
        console.log('💡 You can now go to /dao/bids and assign it to someone else');

    } catch (error) {
        console.error('💥 ===== UNASSIGNMENT FAILED =====');
        console.error('❌ Error:', error.message);
        console.error('📄 Full error:', error);
    }
})();