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