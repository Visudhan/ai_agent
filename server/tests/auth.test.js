const assert = require('assert');

async function testClinicRegistration() {
  const response = await fetch('http://localhost:3000/api/clinic/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Dental Clinic',
      phone: '+919999999999',
      address: 'Kochi, Kerala',
      hours: '9am-5pm'
    })
  });
  const data = await response.json();
  assert(response.status === 200);
  assert(data.api_key);
  console.log('Registration test passed, api_key:', data.api_key);
  return data.api_key;
}

testClinicRegistration().catch(console.error);