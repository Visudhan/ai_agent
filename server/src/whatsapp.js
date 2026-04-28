const db = require('./db');

function handleIncomingMessage(from, message) {
  const phone = from.replace('whatsapp:', '');
  
  return new Promise((resolve) => {
    db.get(
      `SELECT * FROM patients WHERE phone = ? ORDER BY created_at DESC LIMIT 1`,
      [phone],
      (err, patient) => {
        if (patient && patient.name !== 'PENDING') {
          resolve(handleBookingRequest(patient, message));
        } else {
          resolve(askForName(phone, message, 1));
        }
      }
    );
  });
}

function askForName(phone, message, clinicId = 1) {
  db.run('INSERT INTO patients (clinic_id, phone, name) VALUES (?, ?, ?)', 
    [clinicId, phone, 'PENDING'], 
    function(err) {
      if (err) console.error(err);
    }
  );
  
  return "Welcome! Please reply with your full name to book an appointment.";
}

function handleBookingRequest(patient, message) {
  const lines = message.split('\n');
  const name = (lines[0] || '').trim();
  const time = (lines.slice(1).join(' ').trim() || 'Not specified');
  
  if (!name || name.length < 2) {
    return "Please provide a valid name (at least 2 characters).";
  }
  
  if (name.length > 100) {
    return "Name is too long. Please keep it under 100 characters.";
  }
  
  db.run('UPDATE patients SET name = ? WHERE id = ?', [name, patient.id]);
  
  const clinicId = patient.clinic_id || 1;
  db.run(
    'INSERT INTO appointments (clinic_id, patient_id, datetime, status) VALUES (?, ?, ?, ?)',
    [clinicId, patient.id, time, 'pending']
  );

  return `Thank you ${name}! Your appointment for ${time} has been requested. We will confirm shortly.`;
}

module.exports = { handleIncomingMessage };