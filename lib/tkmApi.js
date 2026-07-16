const axios = require('axios');

const API_BASE_URL = 'https://cod3uchiha.com';
const ALLOWED_HOSTS = new Set(['cod3uchiha.com', 'www.cod3uchiha.com']);
const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 60000,
    maxRedirects: 5,
    headers: {
        accept: 'application/json,text/plain,image/*,audio/*,video/*,*/*',
        'user-agent': 'T-WhatsApp-Bot/1.0'
    }
});

function assertApiUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
        throw new Error('Refused a command API URL outside cod3uchiha.com.');
    }
    return url.toString();
}

async function getJson(route, params = {}) {
    const response = await client.get(route, { params, responseType: 'json' });
    return response.data;
}

async function getJsonUrl(value) {
    const response = await axios.get(assertApiUrl(value), {
        timeout: 60000,
        responseType: 'json',
        maxRedirects: 5,
        headers: { 'user-agent': 'T-WhatsApp-Bot/1.0' }
    });
    return response.data;
}

async function getBuffer(route, params = {}) {
    const response = await client.get(route, {
        params,
        responseType: 'arraybuffer',
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024
    });
    return {
        buffer: Buffer.from(response.data),
        contentType: String(response.headers['content-type'] || 'application/octet-stream')
    };
}

async function getMediaFromApiUrl(value) {
    const response = await axios.get(assertApiUrl(value), {
        timeout: 90000,
        responseType: 'arraybuffer',
        maxRedirects: 5,
        maxContentLength: 100 * 1024 * 1024,
        maxBodyLength: 100 * 1024 * 1024,
        headers: { 'user-agent': 'T-WhatsApp-Bot/1.0', accept: '*/*' }
    });
    const buffer = Buffer.from(response.data);
    const contentType = String(response.headers['content-type'] || 'application/octet-stream');
    if (contentType.includes('json') || contentType.startsWith('text/')) {
        const data = JSON.parse(buffer.toString('utf8'));
        const url = findUrl(data, ['downloadUrl', 'downloadURL', 'url', 'audio', 'video', 'mp3', 'mp4']);
        if (!url) throw new Error('TKM-API returned no downloadable media URL.');
        return { url, contentType };
    }
    return { buffer, contentType };
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

function commandArgument(message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || '';
    return String(text).trim().split(/\s+/).slice(1).join(' ').trim();
}

function safeName(value, fallback) {
    return String(value || fallback).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120);
}

function formatError(error) {
    const detail = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Unknown error';
    return `TKM-API request failed: ${detail}`;
}

module.exports = {
    API_BASE_URL,
    getJson,
    getJsonUrl,
    getBuffer,
    getMediaFromApiUrl,
    findUrl,
    commandArgument,
    safeName,
    formatError
};
