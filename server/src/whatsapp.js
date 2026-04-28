const db = require('./db');

function handleIncomingMessage(from, message) {
  const phone = from.replace('whatsapp:', '');
  
  return new Promise((resolve) => {
    db.get(
      `SELECT * FROM patients WHERE phone = ? ORDER BY id DESC LIMIT 1`,
      [phone],
      (err, patient) => {
        console.log('Found patient:', patient);
        
        // If patient exists with a valid name, it's a booking request
        if (patient && patient.name && patient.name !== 'PENDING') {
          resolve(handleBookingRequest(patient, message));
        } 
        // Otherwise, treat this message as their name and create/update
        else {
          resolve(processNameMessage(patient, phone, message));
        }
      }
    );
  });
}

function processNameMessage(patient, phone, message) {
  const name = message.trim();
  
  if (!name || name.length < 2) {
    return "Please provide a valid name (at least 2 characters).";
  }
  
  if (name.length > 100) {
    return "Name is too long. Please keep it under 100 characters.";
  }
  
  return new Promise((resolve) => {
    if (patient && patient.name === 'PENDING') {
      // Update existing pending patient
      db.run('UPDATE patients SET name = ? WHERE id = ?', [name, patient.id], (err) => {
        if (err) {
          console.error(err);
          resolve("Sorry, something went wrong. Please try again.");
          return;
        }
        
        // Create appointment for existing patient
        const clinicId = patient.clinic_id || 1;
        db.run(
          'INSERT INTO appointments (clinic_id, patient_id, datetime, status) VALUES (?, ?, ?, ?)',
          [clinicId, patient.id, 'Not specified', 'pending']
        );
        
        resolve(`Thank you ${name}! Your appointment has been requested. We will confirm shortly.`);
      });
    } else {
      // Create new patient with the name
      db.run('INSERT INTO patients (clinic_id, phone, name) VALUES (?, ?, ?)', 
        [1, phone, name], 
        function(err) {
          if (err) {
            console.error(err);
            resolve("Sorry, something went wrong. Please try again.");
            return;
          }
          
          const patientId = this.lastID;
          // Create appointment
          db.run(
            'INSERT INTO appointments (clinic_id, patient_id, datetime, status) VALUES (?, ?, ?, ?)',
            [1, patientId, 'Not specified', 'pending']
          );
          
          resolve(`Thank you ${name}! Your appointment has been requested. We will confirm shortly.`);
        }
      );
    }
  });
}

function handleBookingRequest(patient, message) {
  // User already has a name, so this is a new booking request
  const lines = message.split('\n');
  const name = (lines[0] || '').trim();
  const time = (lines.slice(1).join(' ').trim() || 'Not specified');
  
  if (!name || name.length < 2) {
    return "Please provide a valid name (at least 2 characters).";
  }
  
  const clinicId = patient.clinic_id || 1;
  db.run(
    'INSERT INTO appointments (clinic_id, patient_id, datetime, status) VALUES (?, ?, ?, ?)',
    [clinicId, patient.id, time, 'pending']
  );

  return `Thank you ${name}! Your appointment for ${time} has been requested. We will confirm shortly.`;
}

module.exports = { handleIncomingMessage };