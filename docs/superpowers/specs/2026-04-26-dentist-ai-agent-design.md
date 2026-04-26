# Dental Clinic AI Agent - Appointment Booking System

**Date:** 2026-04-26  
**Status:** Approved

## 1. Overview

A multi-tenant SaaS platform enabling dental clinics to automate appointment booking via phone IVR and WhatsApp. Clinics sign up, configure their IVR menu, and manage appointments through an admin panel.

## 2. Architecture

```
[Customer Calls] → [Telnyx/Twilio] → [Your Server] → [IVR Logic]
                                                      ↓
                                            [WhatsApp Business API]
                                                      ↓
                                            [Database] → [Admin Panel]
```

## 3. Core Features

### 3.1 IVR Phone System
- **Language selection** - First prompt: "Welcome to [Clinic Name]. To continue in English, press 1. മലയാളത്തില്‍ തുടരാന്‍ രണ്ട് അമര്‍ത്തുക." (Press 1 for English, 2 for Malayalam)
- Multi-language support: English and Malayalam
- Menu options (configurable by clinic, after language selection):
  - Press 1: Book appointment
  - Press 2: Cancel/Reschedule
  - Press 3: Clinic hours
  - Press 4: Speak to receptionist
- **Automatic phone number capture** via Caller ID - no typing needed
- Transfer to WhatsApp flow for booking completion

### 3.2 WhatsApp Booking Bot
- Send message to user: "Enter your name and preferred appointment date/time"
- Parse user response to extract name and appointment
- Confirm booking back to user
- Store in database

### 3.3 Admin Panel
- Clinic registration/login
- Configure IVR menu (text, options)
- View all appointments
- Manage patients
- Set clinic name, hours, services
- View booking analytics

### 3.4 Multi-tenancy
- Each clinic has isolated data
- API keys for connecting phone/WhatsApp
- Role-based access (admin, staff)

## 4. Data Models

### Clinic
- id, name, phone, address, hours, api_key, created_at

### Patient
- id, clinic_id, name, phone, created_at

### Appointment
- id, clinic_id, patient_id, datetime, status (pending/confirmed/cancelled), created_at

### IVRConfig
- id, clinic_id, welcome_message, menu_options (JSON)

## 5. Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQLite (production: PostgreSQL)
- **Phone API:** Twilio or Telnyx (free trial)
- **WhatsApp:** WhatsApp Business API
- **Admin UI:** React (or simple HTML/JS)
- **Voice/TTS:** 
  - For Malayalam: Google Cloud Text-to-Speech (has Malayalam voices) or Eleven Labs (custom voice)
  - For English: Twilio TTS or Google Cloud TTS

## 6. API Endpoints

### Public
- `POST /webhook/phone` - IVR callback from phone provider
- `POST /webhook/whatsapp` - WhatsApp incoming messages

### Admin (authenticated)
- `POST /api/clinic/register` - Clinic signup
- `POST /api/clinic/login` - Clinic login
- `GET /api/appointments` - List appointments
- `PUT /api/appointments/:id` - Update appointment
- `GET /api/patients` - List patients
- `PUT /api/ivr/config` - Update IVR settings

## 7. Flow Details

### Booking Flow
1. Customer calls clinic phone number
2. System automatically captures caller's phone number via Caller ID
3. Telnyx/Twilio hits `/webhook/phone` with caller number
4. Server returns: "Welcome to [Clinic Name]. To continue in English, press 1. മലയാളത്തില്‍ തുടരാന്‍ രണ്ട് അമര്‍ത്തുക."
5. Customer presses 1 (English) or 2 (Malayalam)
6. Server returns main menu in selected language
7. Customer presses 1 (Book appointment)
8. System already has phone number - sends "Check WhatsApp to confirm booking"
9. Server sends WhatsApp message to that number
10. Customer replies with name + time
11. Server parses, creates appointment, confirms via WhatsApp
12. Appointment appears in Admin Panel

## 8. Future Considerations (Out of Scope)
- Payment integration
- Email notifications
- Calendar sync (Google Calendar)
- SMS notifications
- Multiple locations per clinic

## 9. Success Criteria
- Clinics can sign up and configure their IVR
- Callers can complete booking via WhatsApp
- Admins can view and manage appointments
- System handles 100+ concurrent clinics