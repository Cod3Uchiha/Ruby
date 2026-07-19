const settings = require('../settings');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MODE_FILE = path.join(__dirname, '../data/messageCount.json');
const DEFAULT_IMAGE = path.join(__dirname, '../assets/bot_image.jpg');
const READ_MORE = String.fromCharCode(8206).repeat(4001);

const MENU_CATEGORIES = [
    {
        label: 'GENERAL-CMD',
        commands: [
            'menu', 'ping', 'alive', 'owner', '8ball', 'groupinfo',
            'staff', 'vv', 'translate', 'jid', 'topmembers'
        ]
    },
    {
        label: 'ADMIN-CMD',
        commands: [
            'kick', 'ban', 'unban', 'promote', 'demote', 'mute', 'unmute',
            'delete', 'warnings', 'warn', 'clear', 'tagall', 'tagnotadmin',
            'antilink', 'antitag', 'antibadword', 'resetlink', 'welcome',
            'goodbye', 'setgdesc', 'setgname', 'setgpp'
        ]
    },
    {
        label: 'OWNER-CMD',
        commands: [
            'mode', 'settings', 'anticall', 'pmblocker', 'clearsession',
            'autostatus', 'antidelete', 'cleartmp', 'setpp', 'mention',
            'setmention', 'autoreact', 'autotyping', 'autoread', 'sudo'
        ]
    },
    {
        label: 'AI-CMD',
        commands: ['imagine', 'flux']
    },
    {
        label: 'MEDIA-CMD',
        commands: [
            'sticker', 'crop', 'take', 'emojimix', 'music', 'play',
            'video', 'tiktok'
        ]
    },
    {
        label: 'GAME-CMD',
        commands: ['tictactoe', 'move', 'surrender', 'hangman', 'guess']
    },
    {
        label: 'FUN-CMD',
        commands: [
            'compliment', 'insult', 'simp', 'heart', 'horny', 'circle',
            'lgbt', 'lolice', 'simpcard', 'tonikawa', 'its-so-stupid',
            'namecard', 'oogway', 'tweet', 'ytcomment', 'comrade', 'gay',
            'glass', 'jail', 'passed', 'triggered'
        ]
    },
    {
        label: 'ANIME-CMD',
        commands: [
            'nom', 'poke', 'cry', 'kiss', 'pat', 'hug', 'wink',
            'facepalm', 'animuquote'
        ]
    },
    {
        label: 'GITHUB-CMD',
        commands: ['git', 'sc', 'script']
    }
];

function detectPlatform() {
    if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return '🚉 Railway';
    if (process.env.DYNO) return '☁️ Heroku';
    if (process.env.RENDER) return '⚡ Render';
    if (process.env.REPL_ID || process.env.REPL_SLUG) return '🔵 Replit';
    if (process.env.P_SERVER_UUID) return '🖥️ Panel';
    if (process.env.LXC) return '📦 Linux Container';
    if (process.env.TERMUX_VERSION || process.env.PREFIX?.includes('com.termux')) return '📱 Termux';

    switch (os.platform()) {
        case 'win32': return '🪟 Windows';
        case 'darwin': return '🍎 macOS';
        case 'linux': return '🐧 Linux';
        default: return '❓ Unknown';
    }
}

function getModeLabel() {
    try {
        const data = JSON.parse(fs.readFileSync(MODE_FILE, 'utf8'));
        return data.isPublic === false ? '🔒 Private' : '🌐 Public';
    } catch {
        return String(settings.commandMode || 'public').toLowerCase() === 'private'
            ? '🔒 Private'
            : '🌐 Public';
    }
}

function formatUptime() {
    let seconds = Math.floor(process.uptime());
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

function formatMemory(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
}

function progressBar(used, total, size = 10) {
    const ratio = total > 0 ? Math.min(1, Math.max(0, used / total)) : 0;
    const filled = Math.round(ratio * size);
    return `[${'█'.repeat(filled)}${'░'.repeat(size - filled)}] ${Math.round(ratio * 100)}%`;
}

function buildMenuText(speedMs) {
    const prefix = settings.prefix || '.';
    const botName = settings.botName || 'King L';
    const ownerName = settings.botOwner || 'Cod3Uchiha';
    const totalMemory = os.totalmem();
    const systemUsedMemory = totalMemory - os.freemem();
    const botUsedMemory = process.memoryUsage().rss;
    const totalCommands = new Set(MENU_CATEGORIES.flatMap(category => category.commands)).size;

    let menu = `┏━━❐✧ ${botName} ✧❐\n`;
    menu += `┃ *ᴘʀᴇꜰɪx:* [ ${prefix} ]\n`;
    menu += `┃ *ᴏᴡɴᴇʀ:* ${ownerName}\n`;
    menu += `┃ *ᴍᴏᴅᴇ:* ${getModeLabel()}\n`;
    menu += `┃ *ᴘʟᴀᴛꜰᴏʀᴍ:* ${detectPlatform()}\n`;
    menu += `┃ *ꜱᴘᴇᴇᴅ:* ${Math.max(0, Math.round(speedMs))} ms\n`;
    menu += `┃ *ᴜᴘᴛɪᴍᴇ:* ${formatUptime()}\n`;
    menu += `┃ *Vᴇʀꜱɪᴏɴ:* v${settings.version || '1.0.0'}\n`;
    menu += `┃ *ᴜꜱᴀɢᴇ:* ${formatMemory(botUsedMemory)} of ${formatMemory(totalMemory)}\n`;
    menu += `┃ *ʀᴀᴍ:* ${progressBar(systemUsedMemory, totalMemory)}\n`;
    menu += `┃ *Cᴏᴍᴍᴀɴᴅꜱ:* ${totalCommands}\n`;
    menu += `┗❐\n${READ_MORE}\n`;

    for (const category of MENU_CATEGORIES) {
        menu += `┏━━❐◆ \`${category.label}\` ◆❐\n`;
        for (const command of category.commands) {
            menu += `┃➧ ${command}\n`;
        }
        menu += '┗❐\n\n';
    }

    menu += `> ${botName}\nPowered by ${ownerName}`;
    return menu;
}

function getThumbnail() {
    try {
        return fs.existsSync(DEFAULT_IMAGE) ? fs.readFileSync(DEFAULT_IMAGE) : null;
    } catch {
        return null;
    }
}

async function helpCommand(sock, chatId, message) {
    const started = Date.now();
    let loadingMessage;

    try {
        loadingMessage = await sock.sendMessage(chatId, {
            text: '⏳ Loading....'
        }, { quoted: message });

        const speedMs = Date.now() - started;
        const menuText = buildMenuText(speedMs);
        const thumbnail = getThumbnail();
        const botName = settings.botName || 'King L';
        const ownerName = settings.botOwner || 'Cod3Uchiha';
        const sender = message.key.participant || message.key.remoteJid;

        const contextInfo = {
            mentionedJid: sender ? [sender] : [],
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '120363161513685998@newsletter',
                newsletterName: botName,
                serverMessageId: -1
            }
        };

        if (thumbnail) {
            contextInfo.externalAdReply = {
                showAdAttribution: false,
                title: botName,
                body: `Powered by ${ownerName}`,
                thumbnail,
                sourceUrl: 'https://github.com/Cod3Uchiha/Ruby',
                mediaType: 1,
                renderLargerThumbnail: true
            };
        }

        await sock.sendMessage(chatId, {
            text: menuText,
            contextInfo
        }, { quoted: message });

        if (loadingMessage?.key) {
            await sock.sendMessage(chatId, {
                text: `_${botName} Loaded.._`,
                edit: loadingMessage.key
            }).catch(() => {});
        }
    } catch (error) {
        console.error('Error in help command:', error);
        if (loadingMessage?.key) {
            await sock.sendMessage(chatId, {
                text: '❌ Menu failed to load.',
                edit: loadingMessage.key
            }).catch(() => {});
        }
        await sock.sendMessage(chatId, {
            text: `❌ Failed to load menu: ${error.message}`
        }, { quoted: message }).catch(() => {});
    }
}

module.exports = helpCommand;
