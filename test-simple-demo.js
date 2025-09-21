// Simple test for demo-chat endpoint
const sessionId = 1; // Using a simple test session ID

console.log('Testing demo-chat endpoint with session ID:', sessionId);

fetch('http://localhost:4000/api/demo-chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: "I feel anxious about work",
    sessionId: sessionId,
  }),
})
.then(response => {
  console.log('Response status:', response.status);
  return response.json();
})
.then(data => {
  console.log('Response data:', data);
})
.catch(error => {
  console.error('Error:', error);
});