# Dental Clinic AI Agent - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-tenant SaaS platform for dental clinics to automate appointment booking via phone IVR and WhatsApp.

**Architecture:** Express.js backend with SQLite, Twilio/Telnyx for phone IVR, WhatsApp Business API for booking completion, simple admin panel.

**Tech Stack:** Node.js + Express, SQLite, Twilio (phone + TTS), WhatsApp Business API

---

### Task 1: Project Setup & Database

**Files:**
- Create: `server/package.json`
- Create: `server/src/index.js` - Express server entry
- Create: `server/src/db.js` - SQLite setup with all tables

- [ ] **Step 1: Create project structure**

```bash
mkdir -p server/src
cd server
npm init -y
npm install express sqlite3 cors dotenv twilio body-parser
```

- [ ] **Step 2: Create database schema**

```javascript
// server/src/db.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dentist.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clinics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    hours TEXT,
    api_key TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clinic_id INTEGER,
    name TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clinic_id) REFERENCES clinics(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clinic_id INTEGER,
    patient_id INTEGER,
    datetime DATETIME,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clinic_id) REFERENCES clinics(id),
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ivr_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clinic_id INTEGER,
    language TEXT DEFAULT 'en',
    menu_options TEXT,
    FOREIGN KEY(clinic_id) REFERENCES clinics(id)
  )`);
});

module.exports = db;
```

- [ ] **Step 3: Create Express server**

```javascript
// server/src/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Dental AI Agent API' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 4: Test server starts**

Run: `cd server && node src/index.js`
Expected: "Server running on port 3000"

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat: project setup with Express and SQLite database"
```

---

### Task 2: Clinic Authentication (Register/Login)

**Files:**
- Modify: `server/src/index.js`
- Create: `server/tests/auth.test.js`

- [ ] **Step 1: Add auth routes**

```javascript
// Add to server/src/index.js

// Generate API key
function generateApiKey() {
  return 'clinic_' + Math.random().toString(36).substr(2, 16);
}

// Register clinic
app.post('/api/clinic/register', (req, res) => {
  const { name, phone, address, hours } = req.body;
  const api_key = generateApiKey();
  
  db.run(
    'INSERT INTO clinics (name, phone, address, hours, api_key) VALUES (?, ?, ?, ?, ?)',
    [name, phone, address, hours, api_key],
    function(err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, api_key, name });
    }
  );
});

// Login clinic
app.post('/api/clinic/login', (req, res) => {
  const { api_key } = req.body;
  
  db.get('SELECT * FROM clinics WHERE api_key = ?', [api_key], (err, clinic) => {
    if (err || !clinic) return res.status(401).json({ error: 'Invalid API key' });
    res.json({ id: clinic.id, name: clinic.name });
  });
});

// Middleware to authenticate clinic from API key
function authenticateClinic(req, res, next) {
  const api_key = req.headers['x-api-key'];
  if (!api_key) return res.status(401).json({ error: 'API key required' });
  
  db.get('SELECT id, name FROM clinics WHERE api_key = ?', [api_key], (err, clinic) => {
    if (err || !clinic) return res.status(401).json({ error: 'Invalid API key' });
    req.clinic_id = clinic.id;
    next();
  });
}
```

- [ ] **Step 2: Write test**

```javascript
// server/tests/auth.test.js
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
```

- [ ] **Step 3: Run test**

Run: `node server/tests/auth.test.js`
Expected: "Registration test passed"

- [ ] **Step 4: Commit**

```bash
git add server/src server/tests
git commit -m "feat: add clinic registration and login"
```

---

### Task 3: Phone IVR Webhook

**Files:**
- Modify: `server/src/index.js`
- Create: `server/src/twilio.js` - TwiML generators

- [ ] **Step 1: Create TwiML helper**

```javascript
// server/src/twilio.js
const twilio = require('twilio');

function getLanguagePrompt(lang) {
  if (lang === 'ml') {
    return 'മലയാളത്തില്‍ തുടരാന്‍ രണ്ട് അമര്‍ത്തുക.';
  }
  return 'To continue in English, press 1.';
}

function getWelcomeTwiML(clinicName = 'Dental Clinic') {
  return twilio.twiml.VoiceResponse({
    say: { voice: 'Polly.Aditi' }
  }, `Welcome to ${clinicName}. For English press 1. ${getLanguagePrompt('ml')}`);
}

function getMainMenuTwiML(lang = 'en') {
  const response = new twilio.twiml.VoiceResponse();
  if (lang === 'ml') {
    response.say({ voice: 'Polly.Aditi' }, 'ബുക്കിംഗിനായി ഒന്ന് അമര്‍ത്തുക. റദ്ദാക്കാനോ മാറ്റാനോ രണ്ട് അമര്‍ത്തുക. ക്ലിനിക്കിന്റെ സമയം അറിയാന്‍ മൂന്ന് അമര്‍ത്തുക.');
  } else {
    response.say({ voice: 'Polly.Aditi' }, 'For booking, press 1. To cancel or reschedule, press 2. For clinic hours, press 3. To speak to receptionist, press 4.');
  }
  
  response.gather({ numDigits: 1, action: '/webhook/phone/menu' });
  return response;
}

function getBookingConfirmationTwiML(lang = 'en') {
  const response = new twilio.twiml.VoiceResponse();
  if (lang === 'ml') {
    response.say({ voice: 'Polly.Aditi' }, 'ബുക്കിംഗ് സ്ഥിരീകരിക്കാന്‍ വാട്സാപ്പില്‍ സന്ദേശം അയച്ചിട്ടുണ്ട്. ദയവായി അത് പരിശോധിക്കുക.');
  } else {
    response.say({ voice: 'Polly.Aditi' }, 'We have sent a WhatsApp message to confirm your booking. Please check WhatsApp to complete your appointment booking. Thank you.');
  }
  return response;
}

module.exports = { getWelcomeTwiML, getMainMenuTwiML, getBookingConfirmationTwiML };
```

- [ ] **Step 2: Add IVR webhook routes**

```javascript
// Add to server/src/index.js
const { getWelcomeTwiML, getMainMenuTwiML, getBookingConfirmationTwiML } = require('./twilio');

let callState = {}; // In-memory (use Redis in production)

// Initial webhook - language selection
app.post('/webhook/phone', (req, res) => {
  const callerNumber = req.body.From;
  const callSid = req.body.CallSid;
  
  callState[callSid] = { 
    phone: callerNumber, 
    step: 'language',
    clinic_id: 1 // TODO: Lookup by phone number
  };
  
  res.type('text/xml');
  res.send(getWelcomeTwiML('Dental Clinic'));
});

// Menu selection
app.post('/webhook/phone/menu', (req, res) => {
  const digits = req.body.Digits;
  const callSid = req.body.CallSid;
  
  const state = callState[callSid];
  if (!state) {
    res.status(400).send('No call state');
    return;
  }
  
  if (state.step === 'language') {
    state.language = digits === '2' ? 'ml' : 'en';
    state.step = 'main';
    
    res.type('text/xml');
    res.send(getMainMenuTwiML(state.language));
  } else if (state.step === 'main') {
    if (digits === '1') {
      // Book appointment - send to WhatsApp
      // TODO: Save booking request, send WhatsApp
      res.type('text/xml');
      res.send(getBookingConfirmationTwiML(state.language));
    } else if (digits === '3') {
      const response = new twilio.twiml.VoiceResponse();
      response.say('Clinic is open from 9 AM to 5 PM, Monday to Saturday.');
      res.type('text/xml');
      res.send(response);
    } else {
      res.type('text/xml');
      res.send(getMainMenuTwiML(state.language));
    }
  }
});
```

- [ ] **Step 3: Add Twilio client setup**

```javascript
// At top of index.js, add:
const twilio = require('twilio');
// For production, use environment variables
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const twilioClient = twilio(accountSid, authToken);
```

- [ ] **Step 4: Commit**

```bash
git add server/src
git commit -m "feat: add phone IVR webhook with language selection"
```

---

### Task 4: WhatsApp Integration

**Files:**
- Modify: `server/src/index.js`
- Create: `server/src/whatsapp.js` - WhatsApp message handlers

- [ ] **Step 1: Create WhatsApp handler**

```javascript
// server/src/whatsapp.js
const db = require('./db');

function handleIncomingMessage(from, message) {
  const phone = from.replace('whatsapp:', '');
  
  // Check if there's a pending booking
  return new Promise((resolve) => {
    db.get(
      `SELECT * FROM patients WHERE phone = ? ORDER BY created_at DESC LIMIT 1`,
      [phone],
      (err, patient) => {
        if (patient) {
          // Existing patient - parse booking request
          resolve(handleBookingRequest(patient, message));
        } else {
          // New patient - ask for name
          resolve(askForName(phone, message));
        }
      }
    );
  });
}

function askForName(phone, message) {
  // Save as new patient with pending name
  db.run('INSERT INTO patients (phone, name) VALUES (?, ?)', 
    [phone, 'PENDING'], 
    function(err) {
      if (err) console.error(err);
    }
  );
  
  return "Welcome! Please reply with your full name to book an appointment.";
}

function handleBookingRequest(patient, message) {
  // Parse name and time from message
  // Simple parsing - in production use NLP
  const lines = message.split('\n');
  const name = lines[0].trim();
  const time = lines.slice(1).join(' ').trim() || 'Not specified';
  
  // Update patient name
  db.run('UPDATE patients SET name = ? WHERE id = ?', [name, patient.id]);
  
  // Create appointment
  db.run(
    'INSERT INTO appointments (clinic_id, patient_id, datetime, status) VALUES (?, ?, ?, ?)',
    [patient.clinic_id, patient.id, time, 'pending']
  );
  
  return `Thank you ${name}! Your appointment for ${time} has been requested. We will confirm shortly.`;
}

module.exports = { handleIncomingMessage };
```

- [ ] **Step 2: Add WhatsApp webhook**

```javascript
// Add to server/src/index.js
const { handleIncomingMessage } = require('./whatsapp');

app.post('/webhook/whatsapp', (req, res) => {
  const from = req.body.From;
  const message = req.body.Body;
  
  handleIncomingMessage(from, message).then(response => {
    // TODO: Send WhatsApp reply using Twilio
    console.log('WhatsApp response:', response);
    res.send('<Response></Response>');
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add server/src
git commit -m "feat: add WhatsApp message handling"
```

---

### Task 5: Admin Panel

**Files:**
- Create: `server/public/index.html`
- Create: `server/public/admin.js`
- Modify: `server/src/index.js` to serve static files

- [ ] **Step 1: Serve static files**

```javascript
// Add to server/src/index.js
app.use(express.static('public'));
```

- [ ] **Step 2: Create admin HTML**

```html
<!-- server/public/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Dental AI - Admin Panel</title>
  <style>
    body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #2c3e50; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
    input, button { padding: 10px; margin: 5px 0; }
    button { background: #3498db; color: white; border: none; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>🦷 Dental AI Admin Panel</h1>
  
  <div class="section" id="login-section">
    <h2>Clinic Login</h2>
    <input type="text" id="apiKey" placeholder="Enter API Key" style="width: 300px;">
    <button onclick="login()">Login</button>
  </div>
  
  <div class="section" id="appointments-section" style="display:none;">
    <h2>Appointments</h2>
    <button onclick="loadAppointments()">Refresh</button>
    <table id="appointments-table">
      <thead><tr><th>Patient</th><th>Phone</th><th>Date/Time</th><th>Status</th><th>Action</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
  
  <div class="section" id="settings-section" style="display:none;">
    <h2>IVR Settings</h2>
    <input type="text" id="clinicName" placeholder="Clinic Name" style="width: 300px;">
    <button onclick="saveSettings()">Save Settings</button>
  </div>
  
  <script src="admin.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create admin JavaScript**

```javascript
// server/public/admin.js
let apiKey = '';

async function login() {
  apiKey = document.getElementById('apiKey').value;
  const res = await fetch('/api/clinic/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey })
  });
  
  if (res.ok) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('appointments-section').style.display = 'block';
    document.getElementById('settings-section').style.display = 'block';
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
```

- [ ] **Step 4: Add admin API routes**

```javascript
// Add to server/src/index.js

// Get appointments
app.get('/api/appointments', authenticateClinic, (req, res) => {
  db.all(`
    SELECT a.*, p.name as patient_name, p.phone 
    FROM appointments a 
    JOIN patients p ON a.patient_id = p.id 
    WHERE a.clinic_id = ?
    ORDER BY a.created_at DESC
  `, [req.clinic_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Update appointment
app.put('/api/appointments/:id', authenticateClinic, (req, res) => {
  const { status } = req.body;
  db.run('UPDATE appointments SET status = ? WHERE id = ?', 
    [status, req.params.id], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// Update clinic settings
app.put('/api/clinic/settings', authenticateClinic, (req, res) => {
  const { name } = req.body;
  db.run('UPDATE clinics SET name = ? WHERE id = ?', 
    [name, req.clinic_id], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});
```

- [ ] **Step 5: Commit**

```bash
git add server/public server/src
git commit -m "feat: add simple admin panel"
```

---

### Task 6: WhatsApp Outbound Messages

**Files:**
- Modify: `server/src/index.js`

- [ ] **Step 1: Add WhatsApp send function**

```javascript
// Add to server/src/index.js

// Initialize Twilio client (use env vars in production)
const twilioClient = new twilio(
  process.env.TWILIO_ACCOUNT_SID || 'TEST_SID',
  process.env.TWILIO_AUTH_TOKEN || 'TEST_TOKEN'
);

async function sendWhatsAppMessage(to, message) {
  try {
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'}`,
      to: `whatsapp:${to}`,
      body: message
    });
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
  }
}

// Modify the IVR booking to send WhatsApp
app.post('/webhook/phone/menu', (req, res) => {
  // ... existing code ...
  
  if (digits === '1') {
    // Send WhatsApp message
    const phone = state.phone;
    sendWhatsAppMessage(phone, 
      '🦷 Dental Clinic Booking\n\nPlease reply with:\n1. Your full name\n2. Preferred date and time\n\nExample:\nJohn Smith\nTomorrow at 10 AM'
    );
    // ... rest of code
  }
});
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: add WhatsApp outbound messaging"
```

---

### Task 7: Production Readiness

**Files:**
- Create: `server/.env.example`
- Create: `server/Dockerfile`
- Create: `server/docker-compose.yml`

- [ ] **Step 1: Create env example**

```
# server/.env.example
PORT=3000
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+14155238886
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

- [ ] **Step 3: Commit**

```bash
git add server/.env.example server/Dockerfile
git commit -m "chore: add production deployment files"
```

---

## Self-Review Checklist

- [x] Clinic registration/login - Task 2
- [x] Phone IVR with language selection - Task 3
- [x] WhatsApp booking bot - Task 4
- [x] Admin panel - Task 5
- [x] WhatsApp outbound - Task 6
- [x] Production setup - Task 7

---

## Plan Complete

All 7 tasks cover the spec requirements. The system will:
1. Accept calls and capture caller ID automatically
2. Offer English/Malayalam language selection
3. Handle booking via WhatsApp
4. Store appointments in SQLite
5. Provide admin panel for clinic management