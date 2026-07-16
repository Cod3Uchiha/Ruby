const axios = require('axios');

const API_BASE_URL = 'https://cod3uchiha.com';
const API_HOSTS = new Set(['cod3uchiha.com', 'www.cod3uchiha.com']);

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45_000,
  maxRedirects: 5,
  headers: {
    accept: 'application/json, text/plain, image/*, audio/*, video/*, */*',
    'user-agent': 'T-WhatsApp-Bot/1.0'
  }
});

function assertApiUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !API_HOSTS.has(url.hostname)) {
    throw new Error('Refused an API URL outside cod3uchiha.com.');
  }
  return url.toString();
}

async function getJson(route, params = {}) {
  const response = await client.get(route, { params, responseType: 'json' });
  return response.data;
}

async function getJsonUrl(value) {
  const url = assertApiUrl(value);
  const response = await axios.get(url, {
    timeout: 45_000,
    responseType: 'json',
    headers: { 'user-agent': 'T-WhatsApp-Bot/1.0' }
  });
  return response.data;
}

async function getBuffer(route, params = {}) {
  const response = await client.get(route, {
    params,
    responseType: 'arraybuffer',
    maxContentLength: 40 * 1024 * 1024,
    maxBodyLength: 40 * 1024 * 1024
  });

  return {
    buffer: Buffer.from(response.data),
    contentType: String(response.headers['content-type'] || 'application/octet-stream')
  };
}

function findUrl(value, preferredKeys = []) {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? value : null;
    } catch {
      return null;
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item, preferredKeys);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === 'object') {
    for (const key of preferredKeys) {
      const found = findUrl(value[key], preferredKeys);
      if (found) return found;
    }

    for (const child of Object.values(value)) {
      const found = findUrl(child, preferredKeys);
      if (found) return found;
    }
  }

  return null;
}

function formatApiError(error) {
  const detail =
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown API error';

  const status = error?.response?.status;
  return status
    ? `TKM-API returned ${status}: ${detail}`
    : `TKM-API request failed: ${detail}`;
}

module.exports = {
  API_BASE_URL,
  getJson,
  getJsonUrl,
  getBuffer,
  findUrl,
  formatApiError
};
