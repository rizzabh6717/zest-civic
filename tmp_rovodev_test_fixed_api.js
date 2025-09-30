// Test the fixed API calls - run in console on localhost:8082/dao/bids

(async function testFixedAPI() {
    console.log('🔧 ===== TESTING FIXED API =====');
    
    try {
        // Get the auth token from the correct location
        const authToken = localStorage.getItem('auth_token') || localStorage.getItem('authToken');
        console.log('🔑 Auth token found:', authToken ? 'YES' : 'NO');
        
        if (!authToken) {
            console.error('❌ No auth token found. Please login first.');
            return;
        }
        
        // Test the bids endpoint with correct URL and auth
        console.log('📤 Testing bids endpoint with full URL and correct auth...');
        
        const response = await fetch('http://localhost:5000/api/bids', {
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response status:', response.status);
        console.log('✅ Content-Type:', response.headers.get('content-type'));
        
        if (!response.ok) {
            console.error('❌ API call failed:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        console.log('🎉 ✅ SUCCESS! Got JSON response');
        console.log('📊 Total bids:', data.data.bids.length);
        
        // Check for assignments
        const acceptedBids = data.data.bids.filter(bid => bid.status === 'accepted');
        const withAssignments = acceptedBids.filter(bid => bid.assignment);
        
        console.log('\n📊 ===== ASSIGNMENT STATUS =====');
        console.log('Accepted bids:', acceptedBids.length);
        console.log('With assignments:', withAssignments.length);
        
        if (withAssignments.length > 0) {
            console.log('🎉 ✅ ASSIGNMENT LINKING WORKS!');
            console.log('Sample assignment details:');
            console.log('  Assignment ID:', withAssignments[0].assignment._id);
            console.log('  Assignment Status:', withAssignments[0].assignment.status);
            console.log('  Grievance Title:', withAssignments[0].grievance?.title);
            
            // Test unassign with correct API
            window.testUnassignFixed = async (assignmentId) => {
                try {
                    console.log(`🔄 Testing unassign with fixed API for: ${assignmentId}`);
                    
                    const unassignResponse = await fetch('http://localhost:5000/api/dao/unassign-task', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            assignment_id: assignmentId,
                            reason: 'Test unassign with fixed API'
                        })
                    });
                    
                    const result = await unassignResponse.json();
                    
                    if (unassignResponse.ok && result.success) {
                        console.log('🎉 ✅ UNASSIGN SUCCESSFUL!');
                        console.log('📊 Result:', result);
                        console.log('🔄 Task is now available for reassignment');
                    } else {
                        console.error('❌ Unassign failed:', result);
                    }
                    
                } catch (error) {
                    console.error('💥 Unassign error:', error);
                }
            };
            
            console.log('💡 Test unassign with:');
            console.log(`testUnassignFixed("${withAssignments[0].assignment._id}")`);
            
        } else if (acceptedBids.length > 0) {
            console.log('⚠️ Found accepted bids but no assignments');
            console.log('💡 The backend assignment linking may need more work');
        } else {
            console.log('ℹ️ No accepted bids found');
            console.log('💡 Try assigning some tasks first');
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    }
    
    console.log('\n✅ ===== TEST COMPLETE =====');
    console.log('💡 The BidManagement page should now work with proper API calls');
})();