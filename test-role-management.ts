#!/usr/bin/env bun

// Test script for role management functionality
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

async function getAuthToken() {
  try {
    // For testing, use a hardcoded token from environment
    const testToken = process.env.TEST_AUTH_TOKEN;
    if (testToken) {
      return testToken;
    }
    
    // Fallback: try to get token from Clerk session
    const sessionList = await clerkClient.sessions.getSessionList({ limit: 1 });
    if (sessionList.totalCount > 0) {
      return sessionList.data[0].jwt;
    }
    return null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

async function testRoleManagement() {
  console.log("🧪 Testing Role Management API...\n");

  try {
    // Test 1: Get role summary
    console.log("📊 Testing GET /api/role-management/roles/summary");
    const token = await getAuthToken();
    if (!token) {
      console.error("❌ Could not get auth token");
      return;
    }

    const summaryResponse = await fetch('http://localhost:4000/api/role-management/roles/summary', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (summaryResponse.ok) {
      const summary = await summaryResponse.json();
      console.log("✅ Role Summary:", summary);
      console.log(`   Total Users: ${summary.totalUsers}`);
      console.log(`   Superadmins: ${summary.roleCounts.superadmin}`);
      console.log(`   Admins: ${summary.roleCounts.admin}`);
      console.log(`   Observers: ${summary.roleCounts.observer}`);
      console.log(`   Users: ${summary.roleCounts.user}`);
    } else {
      console.error("❌ Failed to get role summary");
    }

    // Test 2: Get users list
    console.log("\n👥 Testing GET /api/role-management/users");
    const usersResponse = await fetch('http://localhost:4000/api/role-management/users?page=1&limit=5', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (usersResponse.ok) {
      const usersData = await usersResponse.json();
      console.log("✅ Users List Retrieved:", usersData.users?.length || 0, "users");
      
      // Test 3: Try to update a user role (this should fail without proper auth)
      if (usersData.users && usersData.users.length > 0) {
        const testUser = usersData.users[0];
        console.log(`\n🔄 Testing role update for user: ${testUser.email}`);
        
        const updateResponse = await fetch(`http://localhost:4000/api/role-management/users/${testUser.id}/role`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newRole: 'observer' }),
        });

        if (updateResponse.ok) {
          console.log("✅ Role update successful");
        } else {
          const error = await updateResponse.json();
          console.error("❌ Role update failed:", error);
        }
      }
    } else {
      console.error("❌ Failed to get users list");
    }

  } catch (error) {
    console.error("💥 Test failed with error:", error);
  }
}

// Run tests
testRoleManagement().then(() => {
  console.log("\n🎉 Role Management API Test Complete!");
  process.exit(0);
}).catch((error) => {
  console.error("💥 Test script failed:", error);
  process.exit(1);
});