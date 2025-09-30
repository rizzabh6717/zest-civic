// Add Worker Role Script
console.log('🔧 Adding worker role to current user...');

const addWorkerRole = async () => {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.error('❌ No auth token found. Please authenticate first.');
      return;
    }

    console.log('📡 Sending request to add worker role...');
    
    const response = await fetch('http://localhost:5000/api/users/add-role', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'worker' })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Worker role added successfully!');
      console.log('📊 User roles:', result.data.user.user_types);
      
      // Update token with new roles
      if (result.data.token) {
        localStorage.setItem('auth_token', result.data.token);
        console.log('🔄 Token updated with new roles');
      }
      
      // Decode and show new token
      const newToken = localStorage.getItem('auth_token');
      const payload = JSON.parse(atob(newToken.split('.')[1]));
      console.log('🎯 New token payload:', {
        userType: payload.userType,
        userTypes: payload.userTypes,
        primaryRole: payload.primaryRole
      });
      
      alert('✅ Worker role added! You can now bid on tasks. Refreshing page...');
      location.reload();
      
    } else {
      console.error('❌ Failed to add worker role:', result.message);
      alert('❌ Failed: ' + result.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    alert('❌ Error: ' + error.message);
  }
};

// Execute the function
addWorkerRole();