// Simple console script to unassign recent task
// Copy and paste this into browser console

(async function() {
    const API_BASE = 'http://localhost:5000/api';
    
    try {
        console.log('🚀 Starting unassign process...');
        
        // Step 1: Try to authenticate
        console.log('🔐 Authenticating...');
        const authResponse = await fetch(`${API_BASE}/users/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: '0xff85a4c7082c12251c80fdf4b7f46ca04e6c43d9',
                signature: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
                message: `Sign this message to authenticate with Zentigrity.\n\nWallet: 0xff85a4c7082c12251c80fdf4b7f46ca04e6c43d9\nUser Type: dao\nTimestamp: ${new Date().toISOString()}`,
                timestamp: new Date().toISOString(),
                userType: 'dao'
            })
        });
        
        console.log('Auth response status:', authResponse.status);
        const authData = await authResponse.json();
        console.log('Auth response data:', authData);
        
        if (!authResponse.ok || !authData.success) {
            console.error('❌ Authentication failed:', authData);
            return;
        }
        
        const token = authData.data.token;
        console.log('✅ Got auth token');
        
        // Step 2: Try to find assignment ID manually
        console.log('📋 You need to provide an assignment ID manually');
        console.log('💡 Run this in a new console line:');
        console.log('window.unassignTask = async (assignmentId) => {');
        console.log('  const response = await fetch("http://localhost:5000/api/dao/unassign-task", {');
        console.log('    method: "POST",');
        console.log('    headers: {');
        console.log('      "Content-Type": "application/json",');
        console.log(`      "Authorization": "Bearer ${token}"`);
        console.log('    },');
        console.log('    body: JSON.stringify({');
        console.log('      assignment_id: assignmentId,');
        console.log('      reason: "Manual unassign via console"');
        console.log('    })');
        console.log('  });');
        console.log('  const result = await response.json();');
        console.log('  console.log("Unassign result:", result);');
        console.log('};');
        console.log('');
        console.log('Then call: unassignTask("YOUR_ASSIGNMENT_ID_HERE")');
        
        // Create the helper function
        window.unassignTask = async (assignmentId) => {
            try {
                console.log(`🔄 Unassigning task: ${assignmentId}`);
                const response = await fetch(`${API_BASE}/dao/unassign-task`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        assignment_id: assignmentId,
                        reason: "Manual unassign via console"
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    console.log('🎉 ✅ UNASSIGN SUCCESSFUL!');
                    console.log('📊 Result:', result);
                    console.log('🔄 Task is now available for reassignment');
                } else {
                    console.error('❌ Unassign failed:', result);
                }
                
                return result;
            } catch (error) {
                console.error('❌ Unassign error:', error);
            }
        };
        
        console.log('✅ Helper function created! You can now use:');
        console.log('unassignTask("YOUR_ASSIGNMENT_ID")');
        
    } catch (error) {
        console.error('💥 Script error:', error);
    }
})();