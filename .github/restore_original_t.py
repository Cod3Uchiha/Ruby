from __future__ import annotations

import base64
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path.cwd()
SOURCE = Path('/tmp/knightbot-original')
COMMANDS = ROOT / 'commands'

SUPPORTED = {'play', 'song', 'video', 'tiktok', 'emojimix', 'imagine', 'translate'}
EXPLICIT_REMOVE = {
    'ai', 'anime', 'attp', 'chatbot', 'character', 'facebook', 'fact', 'github',
    'goodnight', 'igs', 'instagram', 'joke', 'lyrics', 'meme', 'news', 'pair',
    'pies', 'quote', 'remini', 'removebg', 'roseday', 'shayari', 'ship', 'sora',
    'spotify', 'ss', 'stickertelegram', 'textmaker', 'tiktok-alt', 'tts', 'update',
    'url', 'wasted', 'weather'
}
NETWORK_MARKERS = re.compile(
    r"require\(['\"](?:axios|node-fetch|request|gtts|ruhend-scraper|mumaker|translate-google-api|yt-search|ytdl-core)['\"]\)"
    r"|\bfetch\s*\(|\baxios\.|https?\.get\s*\(|\brequest\s*\(",
    re.I,
)
TEXT_NAMES = {'Dockerfile', 'Procfile', 'app.json', 'render.yaml'}
TEXT_SUFFIXES = {'.js', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.css', '.env', '.example', '.sh'}


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def replace_tree() -> None:
    if SOURCE.exists():
        shutil.rmtree(SOURCE)
    run('git', 'clone', '--depth', '1', 'https://github.com/Cod3Uchiha/Knightbot-MD.git', str(SOURCE))

    for child in ROOT.iterdir():
        if child.name == '.git':
            continue
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()

    for child in SOURCE.iterdir():
        if child.name == '.git':
            continue
        target = ROOT / child.name
        if child.is_dir():
            shutil.copytree(child, target)
        else:
            shutil.copy2(child, target)


def is_text_file(path: Path) -> bool:
    return path.name in TEXT_NAMES or path.suffix.lower() in TEXT_SUFFIXES


def rebrand_text(text: str) -> str:
    replacements = {
        'https://github.com/mruniquehacker/Knightbot-MD': 'https://github.com/Cod3Uchiha/Ruby',
        'https://github.com/Cod3Uchiha/Knightbot-MD': 'https://github.com/Cod3Uchiha/Ruby',
        'github.com/mruniquehacker/Knightbot-MD': 'github.com/Cod3Uchiha/Ruby',
        'github.com/Cod3Uchiha/Knightbot-MD': 'github.com/Cod3Uchiha/Ruby',
        'mruniquehacker/Knightbot-MD': 'Cod3Uchiha/Ruby',
        'Cod3Uchiha/Knightbot-MD': 'Cod3Uchiha/Ruby',
        'Mr Unique Hacker': 'Cod3Uchiha',
        'mr_unique_hacker': 'Cod3Uchiha',
        'mruniquehacker': 'Cod3Uchiha',
        'Coded By Professor': 'Coded By Cod3Uchiha',
        'Coded by Professor': 'Coded by Cod3Uchiha',
        '𝗞𝗡𝗜𝗚𝗛𝗧-𝗕𝗢𝗧': '𝗧',
        'ᴋɴɪɢʜᴛ-ʙᴏᴛ': 'ᴛ',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)

    text = re.sub(r'(?i)\bknight(?:[\s_-]*bot)?(?:[\s_-]*md)?\b', 'T', text)
    text = text.replace('T-MD', 'T').replace('T MD', 'T')
    text = text.replace('https://github.com/Cod3Uchiha/T', 'https://github.com/Cod3Uchiha/Ruby')
    return text


def rebrand_repository() -> None:
    for path in ROOT.rglob('*'):
        if not path.is_file() or '.git' in path.parts or not is_text_file(path):
            continue
        try:
            original = path.read_text(encoding='utf-8')
        except UnicodeDecodeError:
            continue
        updated = rebrand_text(original)
        if updated != original:
            path.write_text(updated, encoding='utf-8')

    package_path = ROOT / 'package.json'
    package = json.loads(package_path.read_text(encoding='utf-8'))
    package['name'] = 't-whatsapp-bot'
    package['description'] = 'T WhatsApp bot using cod3uchiha.com for supported external API commands.'
    package['author'] = 'Cod3Uchiha'
    scripts = package.setdefault('scripts', {})
    if 'docker:build' in scripts:
        scripts['docker:build'] = 'docker build -t t-whatsapp-bot .'
    package_path.write_text(json.dumps(package, indent=2) + '\n', encoding='utf-8')

    # Replace the old branded cover while keeping the exact asset path.
    cover = ROOT / 'assets' / 'bot_image.jpg'
    cover.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            ['curl', '-fsSL', 'https://github.com/Cod3Uchiha.png', '-o', str(cover)],
            check=True,
            timeout=30,
        )
    except Exception:
        # Valid 1x1 JPEG fallback with no former branding.
        cover.write_bytes(base64.b64decode(
            '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////'
            '2wBDAf//////////////////////////////////////////////////////////////////////////////////////'
            'wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/'
            '9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAA'
            'AAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAA'
            'AAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAA'
            'ABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EF//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/'
            'EF//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EF//2Q=='
        ))


def write_helper() -> None:
    helper = r'''const axios = require('axios');

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
'''
    (ROOT / 'lib' / 'tkmApi.js').write_text(helper, encoding='utf-8')


def write_supported_commands() -> None:
    play_song = r'''const { getJson, getMediaFromApiUrl, commandArgument, safeName, formatError } = require('../lib/tkmApi');

async function COMMAND_NAME(sock, chatId, message) {
    const query = commandArgument(message);
    if (!query) {
        return sock.sendMessage(chatId, { text: 'Usage: .COMMAND <song name or YouTube URL>' }, { quoted: message });
    }
    try {
        await sock.sendMessage(chatId, { text: 'T is preparing the audio...' }, { quoted: message });
        const data = await getJson('/downloaders/play', { query });
        const item = data?.result;
        if (!item?.audioApi) throw new Error('No audio endpoint was returned.');
        if (item.thumbnail) {
            await sock.sendMessage(chatId, {
                image: { url: item.thumbnail },
                caption: `*${item.title || query}*\n${item.author ? `Channel: ${item.author}\n` : ''}${item.duration ? `Duration: ${item.duration}` : ''}`
            }, { quoted: message });
        }
        const media = await getMediaFromApiUrl(item.audioApi);
        await sock.sendMessage(chatId, {
            audio: media.buffer || { url: media.url },
            mimetype: media.contentType?.startsWith('audio/') ? media.contentType : 'audio/mpeg',
            fileName: `${safeName(item.title, 'T-audio')}.mp3`,
            ptt: false
        }, { quoted: message });
    } catch (error) {
        console.error('[COMMAND] command error:', error);
        await sock.sendMessage(chatId, { text: formatError(error) }, { quoted: message });
    }
}

module.exports = COMMAND_NAME;
'''
    for stem in ('play', 'song'):
        content = play_song.replace('COMMAND_NAME', f'{stem}Command').replace('.COMMAND', f'.{stem}').replace('[COMMAND]', f'[{stem.upper()}]')
        (COMMANDS / f'{stem}.js').write_text(content, encoding='utf-8')

    (COMMANDS / 'video.js').write_text(r'''const { getJson, getMediaFromApiUrl, commandArgument, safeName, formatError } = require('../lib/tkmApi');

async function videoCommand(sock, chatId, message) {
    const query = commandArgument(message);
    if (!query) return sock.sendMessage(chatId, { text: 'Usage: .video <video name or YouTube URL>' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: 'T is preparing the video...' }, { quoted: message });
        const data = await getJson('/downloaders/play', { query });
        const item = data?.result;
        if (!item?.videoApi) throw new Error('No video endpoint was returned.');
        if (item.thumbnail) {
            await sock.sendMessage(chatId, { image: { url: item.thumbnail }, caption: `*${item.title || query}*\nDownloading...` }, { quoted: message });
        }
        const media = await getMediaFromApiUrl(item.videoApi);
        await sock.sendMessage(chatId, {
            video: media.buffer || { url: media.url },
            mimetype: media.contentType?.startsWith('video/') ? media.contentType : 'video/mp4',
            fileName: `${safeName(item.title, 'T-video')}.mp4`,
            caption: `*${item.title || 'Video'}*\n\nDownloaded by T`
        }, { quoted: message });
    } catch (error) {
        console.error('[VIDEO] command error:', error);
        await sock.sendMessage(chatId, { text: formatError(error) }, { quoted: message });
    }
}
module.exports = videoCommand;
''', encoding='utf-8')

    (COMMANDS / 'tiktok.js').write_text(r'''const { getJson, commandArgument, formatError } = require('../lib/tkmApi');
const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    if (processedMessages.has(message.key.id)) return;
    processedMessages.add(message.key.id);
    setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);
    const url = commandArgument(message);
    if (!url) return sock.sendMessage(chatId, { text: 'Usage: .tiktok <TikTok URL>' }, { quoted: message });
    try {
        const data = await getJson('/downloaders/tiktokdl', { url });
        const item = data?.result;
        const videoUrl = item?.noWatermark || item?.standard;
        if (!videoUrl) throw new Error('No TikTok video URL was returned.');
        await sock.sendMessage(chatId, {
            video: { url: videoUrl },
            mimetype: 'video/mp4',
            caption: `${item.title || 'TikTok video'}\n${item.author ? `Author: ${item.author}\n` : ''}Downloaded by T`
        }, { quoted: message });
    } catch (error) {
        console.error('[TIKTOK] command error:', error);
        await sock.sendMessage(chatId, { text: formatError(error) }, { quoted: message });
    }
}
module.exports = tiktokCommand;
''', encoding='utf-8')

    (COMMANDS / 'imagine.js').write_text(r'''const { getBuffer, commandArgument, formatError } = require('../lib/tkmApi');

async function imagineCommand(sock, chatId, message) {
    const prompt = commandArgument(message);
    if (!prompt) return sock.sendMessage(chatId, { text: 'Usage: .imagine <prompt>' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: 'T is generating your image...' }, { quoted: message });
        const { buffer } = await getBuffer('/ai/FluxLora', { prompt, width: 1024, height: 1024 });
        await sock.sendMessage(chatId, { image: buffer, caption: `Generated by T\n\n${prompt}` }, { quoted: message });
    } catch (error) {
        console.error('[IMAGINE] command error:', error);
        await sock.sendMessage(chatId, { text: formatError(error) }, { quoted: message });
    }
}
module.exports = imagineCommand;
''', encoding='utf-8')

    (COMMANDS / 'emojimix.js').write_text(r'''const sharp = require('sharp');
const { getBuffer, commandArgument, formatError } = require('../lib/tkmApi');

async function emojimixCommand(sock, chatId, message) {
    const input = commandArgument(message);
    const [emoji1, emoji2] = input.includes('+') ? input.split('+').map(v => v.trim()) : input.split(/\s+/);
    if (!emoji1 || !emoji2) return sock.sendMessage(chatId, { text: 'Usage: .emojimix 😎+🥰' }, { quoted: message });
    try {
        const { buffer } = await getBuffer('/tools/emojimix', { emoji1, emoji2 });
        const sticker = await sharp(buffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer();
        await sock.sendMessage(chatId, { sticker }, { quoted: message });
    } catch (error) {
        console.error('[EMOJIMIX] command error:', error);
        await sock.sendMessage(chatId, { text: formatError(error) }, { quoted: message });
    }
}
module.exports = emojimixCommand;
''', encoding='utf-8')

    (COMMANDS / 'translate.js').write_text(r'''const { getJson, formatError } = require('../lib/tkmApi');

async function handleTranslateCommand(sock, chatId, message, match) {
    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        let text = quoted?.conversation || quoted?.extendedTextMessage?.text || quoted?.imageMessage?.caption || quoted?.videoMessage?.caption || '';
        let language = '';
        const args = String(match || '').trim().split(/\s+/).filter(Boolean);
        if (quoted) language = args[0] || '';
        else {
            language = args.pop() || '';
            text = args.join(' ');
        }
        if (!text || !language) {
            return sock.sendMessage(chatId, { text: 'Usage: .translate <text> <language-code>\nOr reply: .translate <language-code>' }, { quoted: message });
        }
        const data = await getJson('/tools/trt', { text, language });
        await sock.sendMessage(chatId, { text: String(data.result || data.translation || 'No translation returned.') }, { quoted: message });
    } catch (error) {
        console.error('[TRANSLATE] command error:', error);
        await sock.sendMessage(chatId, { text: formatError(error) }, { quoted: message });
    }
}
module.exports = { handleTranslateCommand };
''', encoding='utf-8')


def extract_imports(main_text: str) -> dict[str, set[str]]:
    mapping: dict[str, set[str]] = {}
    pattern = re.compile(r"^\s*const\s+(.+?)\s*=\s*require\(['\"]\./commands/([^'\"]+)['\"]\);\s*$", re.M)
    for match in pattern.finditer(main_text):
        lhs, module = match.groups()
        names = set(re.findall(r'\b[A-Za-z_$][A-Za-z0-9_$]*\b', lhs))
        mapping[module] = names
    return mapping


def remove_case_blocks(main_text: str, removed_vars: set[str], removed_stems: set[str]) -> str:
    lines = main_text.splitlines(keepends=True)
    first_case = next((i for i, line in enumerate(lines) if re.match(r'^(\s*)case\s+', line)), None)
    if first_case is None:
        return main_text
    indent = re.match(r'^(\s*)case\s+', lines[first_case]).group(1)
    starts = [i for i, line in enumerate(lines) if re.match(rf'^{re.escape(indent)}(?:case\s+|default\s*:)', line)]
    starts.append(len(lines))
    remove_ranges: list[tuple[int, int]] = []
    command_tokens = {f'.{stem}' for stem in removed_stems}
    for left, right in zip(starts, starts[1:]):
        block = ''.join(lines[left:right])
        if any(re.search(rf'\b{re.escape(name)}\b', block) for name in removed_vars) or any(token in block for token in command_tokens):
            remove_ranges.append((left, right))
    for left, right in reversed(remove_ranges):
        del lines[left:right]
    return ''.join(lines)


def remove_external_commands() -> set[str]:
    removed = set(EXPLICIT_REMOVE)
    for path in COMMANDS.glob('*.js'):
        stem = path.stem
        if stem in SUPPORTED:
            continue
        text = path.read_text(encoding='utf-8', errors='ignore')
        if NETWORK_MARKERS.search(text):
            removed.add(stem)

    main_path = ROOT / 'main.js'
    main_text = main_path.read_text(encoding='utf-8')
    imports = extract_imports(main_text)
    removed_vars = set().union(*(imports.get(stem, set()) for stem in removed)) if removed else set()

    import_pattern = re.compile(
        r"^\s*const\s+.+?\s*=\s*require\(['\"]\./commands/(" + '|'.join(re.escape(v) for v in sorted(removed, key=len, reverse=True)) + r")['\"]\);\s*\n?",
        re.M,
    )
    main_text = import_pattern.sub('', main_text)
    main_text = re.sub(
        r"\n\s*// Only run chatbot[^\n]*\n\s*if \(isPublic \|\| isOwnerOrSudoCheck\) \{\n\s*await handleChatbotResponse\([^;]+;\n\s*\}\n",
        '\n',
        main_text,
    )
    main_text = remove_case_blocks(main_text, removed_vars, removed)

    for name in removed_vars:
        if re.search(rf'\b{re.escape(name)}\b', main_text):
            raise RuntimeError(f'Removed command identifier still referenced in main.js: {name}')
    main_path.write_text(main_text, encoding='utf-8')

    for stem in removed:
        path = COMMANDS / f'{stem}.js'
        if path.exists() and stem not in SUPPORTED:
            path.unlink()

    help_path = COMMANDS / 'help.js'
    if help_path.exists():
        lines = help_path.read_text(encoding='utf-8').splitlines(keepends=True)
        filtered = []
        for line in lines:
            lowered = line.lower()
            if any(f'.{stem}' in lowered or f' {stem} ' in lowered for stem in removed):
                continue
            filtered.append(line)
        help_path.write_text(''.join(filtered), encoding='utf-8')

    return removed


def audit(removed: set[str]) -> None:
    checks = [ROOT / 'main.js', ROOT / 'settings.js', ROOT / 'lib' / 'tkmApi.js']
    checks.extend(COMMANDS / f'{name}.js' for name in sorted(SUPPORTED))
    for path in checks:
        run('node', '--check', str(path))

    branded = []
    for path in ROOT.rglob('*'):
        if not path.is_file() or '.git' in path.parts or not is_text_file(path):
            continue
        text = path.read_text(encoding='utf-8', errors='ignore')
        if re.search(r'knight', text, re.I):
            branded.append(str(path.relative_to(ROOT)))
    if branded:
        raise RuntimeError('Old branding remains in: ' + ', '.join(branded))

    violations = []
    for path in COMMANDS.glob('*.js'):
        text = path.read_text(encoding='utf-8', errors='ignore')
        if NETWORK_MARKERS.search(text):
            urls = re.findall(r'https?://[^\s\'"`<>\\)]+', text)
            bad = [url for url in urls if 'cod3uchiha.com' not in url]
            if bad:
                violations.append(f'{path.name}: {bad[0]}')
    if violations:
        raise RuntimeError('External command API violations: ' + '; '.join(violations))

    main_text = (ROOT / 'main.js').read_text(encoding='utf-8')
    for stem in removed:
        if f"./commands/{stem}" in main_text:
            raise RuntimeError(f'Removed command import remains: {stem}')

    report = {
        'identity': 'T',
        'structure': 'Original KnightBot layout preserved',
        'apiBaseUrl': 'https://cod3uchiha.com',
        'supportedExternalCommands': sorted(SUPPORTED),
        'removedUnsupportedExternalCommands': sorted(removed),
    }
    (ROOT / 'MIGRATION_REPORT.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


def main() -> None:
    replace_tree()
    rebrand_repository()
    write_helper()
    removed = remove_external_commands()
    write_supported_commands()
    # Run branding again over newly copied/modified text and normalize generated docs.
    rebrand_repository()
    audit(removed)


if __name__ == '__main__':
    main()
