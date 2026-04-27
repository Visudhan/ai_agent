require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const twilio = require('twilio');

const twilioClient = process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') 
  ? new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

async function sendWhatsAppMessage(to, message) {
  if (!twilioClient) {
    console.log('WhatsApp (mock):', message);
    return;
  }
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

const fs = require('fs');
const path = require('path');
const publicPath = path.resolve('public');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const VALID_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

app.post('/api/clinic/login', (req, res) => {
  const { api_key } = req.body;
  if (!api_key || typeof api_key !== 'string') {
    return res.status(400).json({ error: 'API key required' });
  }
  db.get('SELECT * FROM clinics WHERE api_key = ?', [api_key], (err, clinic) => {
    if (err || !clinic) return res.status(401).json({ error: 'Invalid API key' });
    res.json({ id: clinic.id, name: clinic.name });
  });
});

app.post('/api/clinic/register', (req, res) => {
  const { name, phone, address, hours } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const api_key = 'clinic_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  db.run('INSERT INTO clinics (name, phone, address, hours, api_key) VALUES (?, ?, ?, ?, ?)',
    [name, phone, address, hours, api_key],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, name, api_key });
    }
  );
});

function authenticateClinic(req, res, next) {
  const api_key = req.headers['x-api-key'];
  if (!api_key) return res.status(401).json({ error: 'API key required' });
  db.get('SELECT id, name FROM clinics WHERE api_key = ?', [api_key], (err, clinic) => {
    if (err || !clinic) return res.status(401).json({ error: 'Invalid API key' });
    req.clinic_id = clinic.id;
    req.clinic_name = clinic.name;
    next();
  });
}

const { getWelcomeTwiML, getMainMenuTwiML, getBookingConfirmationTwiML, getHoursTwiML } = require('./twilio');
const { handleIncomingMessage } = require('./whatsapp');

let callState = {};
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000;
  for (const sid in callState) {
    if (now - (callState[sid]?._timestamp || now) > timeout) {
      delete callState[sid];
    }
  }
}, 60000);

app.post('/webhook/phone', (req, res) => {
  const callerNumber = req.body.From;
  const callSid = req.body.CallSid;
  
  callState[callSid] = { 
    phone: callerNumber, 
    step: 'language',
    clinic_id: 1,
    _timestamp: Date.now()
  };
  
  res.type('text/xml');
  res.send(getWelcomeTwiML('Dental Clinic'));
});

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
      sendWhatsAppMessage(state.phone, 
        'Dental Clinic Booking\n\nPlease reply with:\n1. Your full name\n2. Preferred date and time\n\nExample:\nJohn Smith\nTomorrow at 10 AM'
      );
      res.type('text/xml');
      res.send(getBookingConfirmationTwiML(state.language));
    } else if (digits === '2') {
      const response = new twilio.twiml.VoiceResponse();
      response.say({ voice: 'Polly.Aditi' }, 'To cancel or reschedule, please call our office during business hours.');
      res.type('text/xml');
      res.send(response);
    } else if (digits === '3') {
      res.type('text/xml');
      res.send(getHoursTwiML(state.language));
    } else if (digits === '4') {
      db.get('SELECT phone FROM clinics WHERE id = ?', [state.clinic_id], (err, clinic) => {
        const response = new twilio.twiml.VoiceResponse();
        const dialNumber = clinic?.phone || '+1234567890';
        response.say({ voice: 'Polly.Aditi' }, 'Connecting you to the receptionist. Please wait.');
        response.dial(dialNumber);
        res.type('text/xml');
        res.send(response);
      });
    } else {
      res.type('text/xml');
      res.send(getMainMenuTwiML(state.language));
    }
  }
});

app.post('/webhook/whatsapp', (req, res) => {
  const from = req.body.From;
  const message = req.body.Body;
  handleIncomingMessage(from, message).then(response => {
    console.log('WhatsApp response:', response);
    res.send('<Response></Response>');
  });
});

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

app.put('/api/appointments/:id', authenticateClinic, (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: ' + VALID_STATUSES.join(', ') });
  }
  db.run('UPDATE appointments SET status = ? WHERE id = ? AND clinic_id = ?', 
    [status, req.params.id, req.clinic_id], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.put('/api/clinic/settings', authenticateClinic, (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }
  if (name.length > 200) {
    return res.status(400).json({ error: 'Name must be under 200 characters' });
  }
  db.run('UPDATE clinics SET name = ? WHERE id = ?', 
    [name.trim(), req.clinic_id], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.use(express.static(publicPath));
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook')) {
    return next();
  }
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('/api/health', (req, res) => {
  const twilioConfigured = !!(process.env.TWILIO_ACCOUNT_SID?.startsWith('AC') && process.env.TWILIO_AUTH_TOKEN);
  
  db.get('SELECT COUNT(*) as count FROM clinics', (err, result) => {
    db.get('SELECT COUNT(*) as count FROM appointments', (err, aptResult) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        twilio: twilioConfigured ? 'configured' : 'mock mode',
        stats: {
          clinics: result?.count || 0,
          appointments: aptResult?.count || 0
        }
      });
    });
  });
});