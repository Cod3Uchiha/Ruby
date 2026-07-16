const axios = require('axios');

const API_BASE_URL = 'https://cod3uchiha.com';
const API_HOSTS = new Set(['cod3uchiha.com', 'www.cod3uchiha.com']);
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024;
const CATALOG_TTL_MS = 5 * 60 * 1000;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45_000,
  maxRedirects: 5,
  maxContentLength: MAX_RESPONSE_BYTES,
  maxBodyLength: MAX_RESPONSE_BYTES,
  headers: {
    accept: 'application/json, text/plain, image/*, audio/*, video/*, application/pdf, */*',
    'user-agent': 'T-WhatsApp-Bot/2.0'
  }
});

let catalogCache = null;
let catalogCachedAt = 0;
let catalogRequest = null;

function assertApiUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !API_HOSTS.has(url.hostname)) {
    throw new Error('Refused an API URL outside cod3uchiha.com.');
  }
  return url.toString();
}

function assertRoute(value) {
  const route = String(value || '').trim();
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('://')) {
    throw new Error('Invalid TKM-API route.');
  }
  return route;
}

async function getJson(route, params = {}) {
  const response = await client.get(assertRoute(route), { params, responseType: 'json' });
  return response.data;
}

async function getJsonUrl(value) {
  const url = assertApiUrl(value);
  const response = await axios.get(url, {
    timeout: 45_000,
    responseType: 'json',
    maxRedirects: 5,
    headers: { 'user-agent': 'T-WhatsApp-Bot/2.0' }
  });
  return response.data;
}

async function getBuffer(route, params = {}) {
  const response = await client.get(assertRoute(route), {
    params,
    responseType: 'arraybuffer'
  });

  return {
    buffer: Buffer.from(response.data),
    contentType: String(response.headers['content-type'] || 'application/octet-stream'),
    contentDisposition: String(response.headers['content-disposition'] || '')
  };
}

async function requestEndpoint(endpoint, params = {}) {
  const route = assertRoute(endpoint.route);
  const method = String(endpoint.method || 'GET').toUpperCase();
  const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  if (!allowedMethods.has(method)) throw new Error(`Unsupported endpoint method: ${method}`);

  const response = await client.request({
    url: route,
    method,
    params,
    data: method === 'GET' ? undefined : params,
    responseType: 'arraybuffer',
    validateStatus: (status) => status >= 200 && status < 400
  });

  return {
    buffer: Buffer.from(response.data),
    contentType: String(response.headers['content-type'] || endpoint.responseType || 'application/octet-stream'),
    contentDisposition: String(response.headers['content-disposition'] || ''),
    status: response.status
  };
}

function normalizeCatalog(data) {
  if (!data || data.status !== true || !Array.isArray(data.endpoints)) {
    throw new Error('TKM-API returned an invalid endpoint catalog.');
  }

  const endpoints = [];
  for (const category of data.endpoints) {
    const categoryName = String(category?.name || 'Other');
    for (const wrapper of category?.items || []) {
      if (!wrapper || typeof wrapper !== 'object') continue;
      const [displayName, details] = Object.entries(wrapper)[0] || [];
      if (!displayName || !details?.route) continue;

      endpoints.push({
        displayName: String(displayName),
        category: categoryName,
        description: String(details.desc || 'No description provided'),
        method: String(details.method || 'GET').toUpperCase(),
        route: assertRoute(details.route),
        params: Array.isArray(details.params)
          ? details.params.map((param) => ({
              name: String(param.name || param.displayName || '').replace(/^_/, ''),
              displayName: String(param.displayName || param.name || '').replace(/^_/, ''),
              required: param.required !== false,
              type: String(param.type || 'string'),
              description: String(param.description || ''),
              example: param.example == null ? '' : String(param.example)
            })).filter((param) => param.name)
          : [],
        responseType: String(details.responseType || 'JSON or media'),
        notes: String(details.notes || '')
      });
    }
  }

  return {
    count: endpoints.length,
    fetchedAt: new Date().toISOString(),
    endpoints
  };
}

async function getCatalog({ force = false } = {}) {
  const fresh = catalogCache && Date.now() - catalogCachedAt < CATALOG_TTL_MS;
  if (!force && fresh) return catalogCache;
  if (catalogRequest) return catalogRequest;

  catalogRequest = getJson('/catalog')
    .then(normalizeCatalog)
    .then((catalog) => {
      catalogCache = catalog;
      catalogCachedAt = Date.now();
      return catalog;
    })
    .finally(() => {
      catalogRequest = null;
    });

  return catalogRequest;
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
  let responseDetail = error?.response?.data;
  if (Buffer.isBuffer(responseDetail)) responseDetail = responseDetail.toString('utf8');
  if (responseDetail instanceof ArrayBuffer) responseDetail = Buffer.from(responseDetail).toString('utf8');

  if (typeof responseDetail === 'string') {
    try {
      responseDetail = JSON.parse(responseDetail);
    } catch {
      // Keep text response as-is.
    }
  }

  const detail =
    responseDetail?.error ||
    responseDetail?.message ||
    (typeof responseDetail === 'string' ? responseDetail : null) ||
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
  getCatalog,
  requestEndpoint,
  findUrl,
  formatApiError
};
