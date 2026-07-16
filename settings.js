require('dotenv').config();

const cleanNumber = (value = '') => String(value).replace(/\D/g, '');

module.exports = Object.freeze({
  botName: 'T',
  prefix: process.env.PREFIX || '.',
  ownerNumber: cleanNumber(process.env.OWNER_NUMBER || ''),
  pairingNumber: cleanNumber(process.env.PAIRING_NUMBER || process.env.OWNER_NUMBER || ''),
  sessionDirectory: process.env.SESSION_DIRECTORY || './session',
  apiBaseUrl: 'https://cod3uchiha.com',
  logLevel: process.env.LOG_LEVEL || 'silent',
  browser: ['T', 'Chrome', '1.0.0']
});
