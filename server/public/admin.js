let apiKey = '';
let clinicName = '';

async function login() {
  apiKey = document.getElementById('apiKey').value;
  const res = await fetch('/api/clinic/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey })
  });
  
  if (res.ok) {
    const data = await res.json();
    clinicName = data.name;
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('appointments-section').style.display = 'block';
    document.getElementById('settings-section').style.display = 'block';
    document.getElementById('clinicName').value = clinicName;
    document.querySelector('h1').textContent = clinicName + ' - Admin Panel';
    loadAppointments();
  } else {
    alert('Invalid API key');
  }
}

async function loadAppointments() {
  const res = await fetch('/api/appointments', {
    headers: { 'x-api-key': apiKey }
  });
  const appointments = await res.json();
  
  const tbody = document.querySelector('#appointments-table tbody');
  tbody.innerHTML = appointments.map(apt => `
    <tr>
      <td>${apt.patient_name}</td>
      <td>${apt.phone}</td>
      <td>${apt.datetime}</td>
      <td>${apt.status}</td>
      <td>
        ${apt.status === 'pending' ? `<button onclick="updateStatus(${apt.id}, 'confirmed')">Confirm</button>` : ''}
        <button onclick="updateStatus(${apt.id}, 'cancelled')">Cancel</button>
      </td>
    </tr>
  `).join('');
}

async function updateStatus(id, status) {
  await fetch(`/api/appointments/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ status })
  });
  loadAppointments();
}

async function saveSettings() {
  const name = document.getElementById('clinicName').value;
  await fetch('/api/clinic/settings', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({ name })
  });
  alert('Settings saved!');
}