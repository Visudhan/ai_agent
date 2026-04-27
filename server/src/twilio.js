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

function getHoursTwiML(lang = 'en') {
  const response = new twilio.twiml.VoiceResponse();
  if (lang === 'ml') {
    response.say({ voice: 'Polly.Aditi' }, 'ക്ലിനിക്ക് രാവിലെ ഒമ്പത് മണിമുതല്‍ വൈകിട്ട് അഞ്ച് മണിവരെ പ്രവര്‍ത്തിക്കുന്നു. തിങ്കളാഴ്ച മുതല്‍ ശനിയാഴ്ച വരെ.');
  } else {
    response.say({ voice: 'Polly.Aditi' }, 'Clinic is open from 9 AM to 5 PM, Monday to Saturday.');
  }
  return response;
}

module.exports = { getWelcomeTwiML, getMainMenuTwiML, getBookingConfirmationTwiML, getHoursTwiML };