// Console test for assignment linking
// Run this in the browser console while on localhost:8082/dao/bids

(async function testAssignmentLinking() {
    console.log('🔗 ===== TESTING ASSIGNMENT LINKING =====');
    
    try {
        // Test 1: Check if we can fetch bids with assignments
        console.log('📤 Fetching bids from current session...');
        
        const response = await fetch('/api/bids', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            console.error('❌ Failed to fetch bids:', response.status, response.statusText);
            return;
        }
        
        const data = await response.json();
        console.log('✅ Bids fetched successfully');
        console.log('📊 Total bids found:', data.data.bids.length);
        
        // Analyze the bids
        const acceptedBids = data.data.bids.filter(bid => bid.status === 'accepted');
        const acceptedWithAssignments = acceptedBids.filter(bid => bid.assignment);
        const acceptedWithoutAssignments = acceptedBids.filter(bid => !bid.assignment);
        
        console.log('\n📊 ===== ANALYSIS =====');
        console.log('Total accepted bids:', acceptedBids.length);
        console.log('Accepted bids WITH assignments:', acceptedWithAssignments.length);
        console.log('Accepted bids WITHOUT assignments:', acceptedWithoutAssignments.length);
        
        // Show details of accepted bids
        if (acceptedBids.length > 0) {
            console.log('\n📋 ===== ACCEPTED BIDS DETAILS =====');
            acceptedBids.forEach((bid, index) => {
                console.log(`\nBid ${index + 1}:`);
                console.log('  Bid ID:', bid._id);
                console.log('  Grievance:', bid.grievance?.title || 'Unknown');
                console.log('  Amount:', bid.bid_amount);
                console.log('  Has Assignment:', bid.assignment ? '✅ YES' : '❌ NO');
                
                if (bid.assignment) {
                    console.log('  Assignment ID:', bid.assignment._id);
                    console.log('  Assignment Status:', bid.assignment.status);
                    console.log('  Escrow Amount:', bid.assignment.escrow_amount);
                }
            });
        }
        
        // Test unassign function if assignments exist
        if (acceptedWithAssignments.length > 0) {
            console.log('\n🧪 ===== UNASSIGN FUNCTION TEST =====');
            console.log('✅ Assignment linking is working!');
            console.log('You can test unassign by running:');
            
            const firstAssignment = acceptedWithAssignments[0];
            console.log(`testUnassign("${firstAssignment.assignment._id}", "${firstAssignment.grievance?.title || 'Test Task'}")`);
            
            // Create the test function
            window.testUnassign = async (assignmentId, taskTitle) => {
                try {
                    console.log(`🔄 Testing unassign for: ${taskTitle}`);
                    console.log(`📋 Assignment ID: ${assignmentId}`);
                    
                    const unassignResponse = await fetch('/api/dao/unassign-task', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            assignment_id: assignmentId,
                            reason: 'Console test unassignment'
                        })
                    });
                    
                    const result = await unassignResponse.json();
                    
                    if (unassignResponse.ok && result.success) {
                        console.log('🎉 ✅ UNASSIGN SUCCESSFUL!');
                        console.log('📊 Result:', result);
                        console.log('🔄 Task is now available for reassignment');
                        
                        // Suggest refreshing the page
                        console.log('💡 Refresh the page to see updated status');
                    } else {
                        console.error('❌ Unassign failed:', result);
                    }
                    
                } catch (error) {
                    console.error('💥 Unassign error:', error);
                }
            };
            
            console.log('✅ testUnassign function created!');
            
        } else if (acceptedWithoutAssignments.length > 0) {
            console.log('\n⚠️ ===== ASSIGNMENT LINKING ISSUE =====');
            console.log('❌ Found accepted bids but no assignment links');
            console.log('💡 This means the backend changes may not be applied yet');
            console.log('🔧 Try restarting the backend server');
            
        } else {
            console.log('\n ℹ️ ===== NO ACCEPTED BIDS =====');
            console.log('📋 No accepted bids found');
            console.log('💡 Try assigning some tasks first');
            console.log('🎯 Go to /dao/bids and click "Assign Work" on pending bids');
        }
        
    } catch (error) {
        console.error('💥 ===== TEST FAILED =====');
        console.error('❌ Error:', error.message);
        console.error('📄 Full error:', error);
        
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
            console.error('🌐 Network issue - make sure you\'re on localhost:8082');
        }
    }
    
    console.log('\n✅ ===== TEST COMPLETE =====');
})();