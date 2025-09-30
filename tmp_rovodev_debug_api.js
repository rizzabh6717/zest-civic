// Debug API calls - run in console on localhost:8082/dao/bids

(async function debugAPI() {
    console.log('🔍 ===== API DEBUG TEST =====');
    
    try {
        // Test 1: Check what endpoint actually works
        console.log('🧪 Testing different endpoints...');
        
        const endpoints = [
            '/api/bids',
            '/api/worker-bids', 
            'http://localhost:5000/api/bids',
            'http://localhost:5000/api/worker-bids'
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`📤 Testing: ${endpoint}`);
                
                const response = await fetch(endpoint, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log(`  Status: ${response.status}`);
                console.log(`  Content-Type: ${response.headers.get('content-type')}`);
                
                const text = await response.text();
                console.log(`  Response length: ${text.length} chars`);
                console.log(`  Starts with: ${text.substring(0, 100)}...`);
                
                // Try to parse as JSON
                try {
                    const json = JSON.parse(text);
                    console.log(`  ✅ Valid JSON! Found ${json.data?.bids?.length || 0} bids`);
                    
                    if (json.data?.bids) {
                        const accepted = json.data.bids.filter(b => b.status === 'accepted');
                        const withAssignments = accepted.filter(b => b.assignment);
                        console.log(`  📊 Accepted: ${accepted.length}, With assignments: ${withAssignments.length}`);
                        
                        if (withAssignments.length > 0) {
                            console.log(`  🎉 Found working endpoint with assignments!`);
                            console.log(`  Sample assignment ID: ${withAssignments[0].assignment._id}`);
                            
                            // Store the working endpoint
                            window.WORKING_ENDPOINT = endpoint;
                            window.SAMPLE_ASSIGNMENT_ID = withAssignments[0].assignment._id;
                            
                            return; // Stop testing, we found a working one
                        }
                    }
                    
                } catch (parseError) {
                    console.log(`  ❌ Not valid JSON`);
                }
                
            } catch (fetchError) {
                console.log(`  💥 Fetch failed: ${fetchError.message}`);
            }
            
            console.log(''); // Empty line for readability
        }
        
        console.log('🔧 Manual auth test...');
        
        // Try to get auth token from localStorage/sessionStorage
        const authSources = [
            localStorage.getItem('auth'),
            localStorage.getItem('authToken'), 
            localStorage.getItem('token'),
            sessionStorage.getItem('auth'),
            sessionStorage.getItem('authToken'),
            sessionStorage.getItem('token')
        ];
        
        let token = null;
        for (const source of authSources) {
            if (source) {
                try {
                    const parsed = JSON.parse(source);
                    token = parsed.token || parsed.accessToken || source;
                    if (token) break;
                } catch {
                    token = source; // If it's not JSON, maybe it's the token directly
                }
            }
        }
        
        if (token) {
            console.log('🔑 Found potential auth token');
            
            // Test with auth header
            const authResponse = await fetch('http://localhost:5000/api/bids', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`Auth test status: ${authResponse.status}`);
            const authText = await authResponse.text();
            
            try {
                const authJson = JSON.parse(authText);
                console.log('✅ Auth header worked!', authJson);
            } catch {
                console.log('❌ Auth header failed, got HTML');
            }
        } else {
            console.log('❌ No auth token found in storage');
        }
        
    } catch (error) {
        console.error('💥 Debug failed:', error);
    }
})();