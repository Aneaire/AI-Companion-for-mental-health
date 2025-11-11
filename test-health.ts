#!/usr/bin/env bun

// Simple test script for the health endpoint
const testHealthEndpoint = async () => {
  try {
    console.log('Testing health endpoint...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('http://localhost:4000/api/health', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Health check failed: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log('Health check response:');
    console.log(JSON.stringify(data, null, 2));

    // Validate the response structure
    const requiredFields = ['status', 'timestamp', 'service', 'checks'];
    const missingFields = requiredFields.filter(field => !(field in data));

    if (missingFields.length > 0) {
      console.error(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    console.log('✅ Health endpoint test passed!');
  } catch (error: any) {
    console.error('Health endpoint test failed:', error?.message || 'Unknown error');
  }
};

// Only run if this script is executed directly
if (import.meta.main) {
  testHealthEndpoint();
}

export { testHealthEndpoint };