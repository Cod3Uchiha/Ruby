const sharp = require('sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const {
  API_BASE_URL,
  getJson,
  getJsonUrl,
  getBuffer,
  getCatalog,
  requestEndpoint,
  findUrl,
  formatApiError
} = require('./api');

const MAX_TEXT_CHUNK = 3500;

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function targetJid(ctx) {
  const info = ctx.message.message?.extendedTextMessage?.contextInfo;
  return info?.mentionedJid?.[0] || info?.participant || null;
}

function mediaTarget(ctx) {
  const info = ctx.message.message?.extendedTextMessage?.contextInfo;
  if (info?.quotedMessage) {
    return {
      key: {
        remoteJid: ctx.chatId,
        id: info.stanzaId,
        participant: info.participant
      },
      message: info.quotedMessage
    };
  }
  return ctx.message;
}

function splitLongText(text, maxLength = MAX_TEXT_CHUNK) {
  const value = String(text || '');
  if (value.length <= maxLength) return [value];

  const chunks = [];
  let remaining = value;
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf('\n', maxLength);
    if (cut < maxLength * 0.5) cut = remaining.lastIndexOf(' ', maxLength);
    if (cut < maxLength * 0.5) cut = maxLength;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function replyLong(ctx, text) {
  for (const chunk of splitLongText(text)) {
    await ctx.reply(chunk);
  }
}

function cleanFilename(value, fallback = 'T-response') {
  const cleaned = String(value || fallback)
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 100) || fallback;
}

function extensionFromType(contentType) {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('jpeg')) return 'jpg';
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  if (type.includes('svg')) return 'svg';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';
  if (type.includes('pdf')) return 'pdf';
  if (type.includes('json')) return 'json';
  if (type.startsWith('text/')) return 'txt';
  return 'bin';
}

function parseContentDispositionFilename(value) {
  const match = String(value || '').match(/filename\*?=(?:UTF-8''|["']?)([^"';\r\n]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].replace(/["']/g, '').trim());
  } catch {
    return match[1].replace(/["']/g, '').trim();
  }
}

function parseJsonBuffer(buffer) {
  const text = buffer.toString('utf8').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function sendEndpointResponse(ctx, endpoint, response) {
  const contentType = String(response.contentType || endpoint.responseType || '').toLowerCase();
  const suggestedName = parseContentDispositionFilename(response.contentDisposition);
  const baseName = cleanFilename(suggestedName || endpoint.displayName || slug(endpoint.route));

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    const data = parseJsonBuffer(response.buffer);
    if (data !== null) {
      return replyLong(ctx, `*${endpoint.displayName}*\n\n${JSON.stringify(data, null, 2)}`);
    }
  }

  if (contentType.startsWith('text/') || contentType.includes('xml')) {
    const text = response.buffer.toString('utf8');
    if (contentType.includes('svg')) {
      return ctx.sock.sendMessage(
        ctx.chatId,
        {
          document: response.buffer,
          mimetype: contentType.split(';')[0],
          fileName: suggestedName || `${baseName}.svg`,
          caption: endpoint.displayName
        },
        { quoted: ctx.message }
      );
    }
    return replyLong(ctx, `*${endpoint.displayName}*\n\n${text}`);
  }

  if (contentType.startsWith('image/')) {
    return ctx.sock.sendMessage(
      ctx.chatId,
      { image: response.buffer, caption: endpoint.displayName },
      { quoted: ctx.message }
    );
  }

  if (contentType.startsWith('audio/')) {
    return ctx.sock.sendMessage(
      ctx.chatId,
      {
        audio: response.buffer,
        mimetype: contentType.split(';')[0],
        fileName: suggestedName || `${baseName}.${extensionFromType(contentType)}`
      },
      { quoted: ctx.message }
    );
  }

  if (contentType.startsWith('video/')) {
    return ctx.sock.sendMessage(
      ctx.chatId,
      {
        video: response.buffer,
        mimetype: contentType.split(';')[0],
        caption: endpoint.displayName
      },
      { quoted: ctx.message }
    );
  }

  const maybeJson = parseJsonBuffer(response.buffer);
  if (maybeJson !== null) {
    return replyLong(ctx, `*${endpoint.displayName}*\n\n${JSON.stringify(maybeJson, null, 2)}`);
  }

  const extension = extensionFromType(contentType);
  return ctx.sock.sendMessage(
    ctx.chatId,
    {
      document: response.buffer,
      mimetype: contentType.split(';')[0] || 'application/octet-stream',
      fileName: suggestedName || `${baseName}.${extension}`,
      caption: endpoint.displayName
    },
    { quoted: ctx.message }
  );
}

function parseNamedParameters(text, endpointParams) {
  const names = new Map(endpointParams.map((param) => [param.name.toLowerCase(), param.name]));
  const matches = [];
  const pattern = /(?:^|\s)([A-Za-z_][A-Za-z0-9_-]*)=/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const lookupKey = match[1].toLowerCase();
    const key = names.get(lookupKey);
    if (key) {
      matches.push({ key, start: match.index + match[0].indexOf(match[1]), valueStart: pattern.lastIndex });
    }
  }
  if (!matches.length) return null;

  const output = {};
  matches.forEach((entry, index) => {
    const end = index + 1 < matches.length ? matches[index + 1].start : text.length;
    output[entry.key] = text.slice(entry.valueStart, end).trim().replace(/^['"]|['"]$/g, '');
  });
  return output;
}

function parseEndpointParams(text, endpoint) {
  const params = endpoint.params || [];
  if (!params.length) return {};

  const named = parseNamedParameters(text, params);
  if (named) return named;

  if (text.includes('|')) {
    const pieces = text.split('|').map((part) => part.trim());
    return Object.fromEntries(params.map((param, index) => [param.name, pieces[index] || '']));
  }

  if (params.length === 1) return { [params[0].name]: text.trim() };

  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const output = {};
  params.forEach((param, index) => {
    if (index === params.length - 1) output[param.name] = tokens.slice(index).join(' ');
    else output[param.name] = tokens[index] || '';
  });
  return output;
}

function endpointUsage(endpoint) {
  if (!endpoint.params?.length) return '';
  return endpoint.params
    .map((param) => `${param.name}=${param.example || `<${param.displayName || param.name}>`}`)
    .join(' ');
}

function missingRequiredParams(endpoint, values) {
  return (endpoint.params || [])
    .filter((param) => param.required && !String(values[param.name] || '').trim())
    .map((param) => param.name);
}

const commands = [];
const commandMap = new Map();
let dynamicCount = 0;
let lastCatalogRefresh = null;

const baseCommands = [
  {
    name: 'menu',
    aliases: ['help', 'commands'],
    category: 'general',
    description: 'Show every local and TKM-API command.',
    usage: '[category]',
    async run(ctx) {
      const filter = slug(ctx.text);
      const grouped = new Map();
      for (const command of commands) {
        const category = command.category || 'other';
        if (filter && filter !== 'all' && slug(category) !== filter && slug(command.name) !== filter) continue;
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push(command);
      }

      if (!grouped.size) {
        const categories = [...new Set(commands.map((command) => command.category || 'other'))].sort();
        return ctx.reply(`Unknown category. Available categories:\n${categories.join('\n')}`);
      }

      const header = `*T*\nCommands: ${commands.length} (${dynamicCount} live API endpoints)\nAPI: ${API_BASE_URL}`;
      const sections = [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, items]) => {
          const rows = items
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => `${ctx.settings.prefix}${item.name}${item.usage ? ` ${item.usage}` : ''} — ${item.description}`)
            .join('\n');
          return `*${category.toUpperCase()}*\n${rows}`;
        });

      await replyLong(ctx, `${header}\n\n${sections.join('\n\n')}`);
    }
  },
  {
    name: 'ping',
    aliases: ['speed'],
    category: 'general',
    description: 'Check latency and uptime.',
    async run(ctx) {
      const started = Date.now();
      await ctx.reply('Pong.');
      const latency = Date.now() - started;
      const total = Math.floor(process.uptime());
      const hours = Math.floor(total / 3600);
      const minutes = Math.floor((total % 3600) / 60);
      const seconds = total % 60;
      await ctx.reply(`*T*\nLatency: ${latency} ms\nUptime: ${hours}h ${minutes}m ${seconds}s`);
    }
  },
  {
    name: 'alive',
    aliases: ['status'],
    category: 'general',
    description: 'Show whether T is online.',
    async run(ctx) {
      await ctx.reply(`T is online.\nExternal API: ${API_BASE_URL}\nLoaded API commands: ${dynamicCount}`);
    }
  },
  {
    name: 'owner',
    category: 'general',
    description: 'Show the configured owner.',
    async run(ctx) {
      await ctx.reply(ctx.settings.ownerNumber ? `Owner: +${ctx.settings.ownerNumber}` : 'OWNER_NUMBER is not configured.');
    }
  },
  {
    name: 'api',
    category: 'general',
    description: 'Show TKM-API status and catalog information.',
    async run(ctx) {
      await ctx.reply(
        `T uses only:\n${API_BASE_URL}\n\nCatalog:\n${API_BASE_URL}/catalog\n\nLoaded endpoints: ${dynamicCount}\nLast refresh: ${lastCatalogRefresh || 'Not loaded'}`
      );
    }
  },
  {
    name: 'apirefresh',
    aliases: ['refreshapi'],
    category: 'general',
    description: 'Reload all commands from the live TKM-API catalog.',
    ownerOnly: true,
    async run(ctx) {
      const count = await refreshApiCommands({ force: true });
      await ctx.reply(`Reloaded ${count} TKM-API commands.`);
    }
  },
  {
    name: 'groupinfo',
    aliases: ['ginfo'],
    category: 'group',
    description: 'Show group information.',
    groupOnly: true,
    async run(ctx) {
      const admins = ctx.participants.filter((item) => item.admin).length;
      await ctx.reply(
        `*${ctx.metadata.subject}*\nMembers: ${ctx.participants.length}\nAdmins: ${admins}\nID: ${ctx.chatId}\nDescription: ${ctx.metadata.desc || 'None'}`
      );
    }
  },
  {
    name: 'tagall',
    category: 'group',
    description: 'Mention every member.',
    usage: '[message]',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      const mentions = ctx.participants.map((item) => ctx.normalizeJid(item.id));
      const lines = mentions.map((jid) => `@${ctx.numberFromJid(jid)}`).join('\n');
      await ctx.sock.sendMessage(
        ctx.chatId,
        { text: `${ctx.text || 'Attention everyone'}\n\n${lines}`, mentions },
        { quoted: ctx.message }
      );
    }
  },
  {
    name: 'hidetag',
    aliases: ['htag'],
    category: 'group',
    description: 'Silently mention every member.',
    usage: '<message>',
    groupOnly: true,
    adminOnly: true,
    async run(ctx) {
      if (!ctx.text) return ctx.reply(`Usage: ${ctx.settings.prefix}hidetag <message>`);
      const mentions = ctx.participants.map((item) => ctx.normalizeJid(item.id));
      await ctx.sock.sendMessage(ctx.chatId, { text: ctx.text, mentions }, { quoted: ctx.message });
    }
  },
  {
    name: 'mute',
    aliases: ['close'],
    category: 'group',
    description: 'Allow only admins to send messages.',
    groupOnly: true,
    adminOnly: true,
    botAdmin: true,
    async run(ctx) {
      await ctx.sock.groupSettingUpdate(ctx.chatId, 'announcement');
      await ctx.reply('Group muted.');
    }
  },
  {
    name: 'unmute',
    aliases: ['open'],
    category: 'group',
    description: 'Allow everyone to send messages.',
    groupOnly: true,
    adminOnly: true,
    botAdmin: true,
    async run(ctx) {
      await ctx.sock.groupSettingUpdate(ctx.chatId, 'not_announcement');
      await ctx.reply('Group unmuted.');
    }
  },
  {
    name: 'kick',
    aliases: ['remove'],
    category: 'group',
    description: 'Remove a mentioned or replied-to member.',
    groupOnly: true,
    adminOnly: true,
    botAdmin: true,
    async run(ctx) {
      const target = targetJid(ctx);
      if (!target) return ctx.reply('Mention or reply to the member to remove.');
      await ctx.sock.groupParticipantsUpdate(ctx.chatId, [target], 'remove');
    }
  },
  {
    name: 'promote',
    category: 'group',
    description: 'Promote a member.',
    groupOnly: true,
    adminOnly: true,
    botAdmin: true,
    async run(ctx) {
      const target = targetJid(ctx);
      if (!target) return ctx.reply('Mention or reply to the member to promote.');
      await ctx.sock.groupParticipantsUpdate(ctx.chatId, [target], 'promote');
    }
  },
  {
    name: 'demote',
    category: 'group',
    description: 'Demote an administrator.',
    groupOnly: true,
    adminOnly: true,
    botAdmin: true,
    async run(ctx) {
      const target = targetJid(ctx);
      if (!target) return ctx.reply('Mention or reply to the administrator to demote.');
      await ctx.sock.groupParticipantsUpdate(ctx.chatId, [target], 'demote');
    }
  },
  {
    name: 'delete',
    aliases: ['del'],
    category: 'group',
    description: 'Delete a replied-to message.',
    async run(ctx) {
      const info = ctx.message.message?.extendedTextMessage?.contextInfo;
      if (!info?.stanzaId) return ctx.reply('Reply to the message to delete.');
      await ctx.sock.sendMessage(ctx.chatId, {
        delete: {
          remoteJid: ctx.chatId,
          id: info.stanzaId,
          participant: info.participant,
          fromMe: false
        }
      });
    }
  },
  {
    name: 'sticker',
    aliases: ['s'],
    category: 'media',
    description: 'Convert an image or short video into a sticker locally.',
    async run(ctx) {
      const target = mediaTarget(ctx);
      if (!target.message?.imageMessage && !target.message?.videoMessage) {
        return ctx.reply('Reply to an image or short video.');
      }

      const input = await downloadMediaMessage(
        target,
        'buffer',
        {},
        {
          logger: ctx.logger,
          reuploadRequest: ctx.sock.updateMediaMessage
        }
      );

      const sticker = await sharp(input, { animated: true })
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .webp({ quality: 85 })
        .toBuffer();

      await ctx.sock.sendMessage(ctx.chatId, { sticker }, { quoted: ctx.message });
    }
  },
  {
    name: 'play',
    aliases: ['yts', 'youtube'],
    category: 'cod3-api-shortcuts',
    description: 'Search YouTube through cod3uchiha.com.',
    usage: '<query>',
    async run(ctx) {
      if (!ctx.text) return ctx.reply(`Usage: ${ctx.settings.prefix}play <query>`);
      try {
        const data = await getJson('/downloaders/play', { query: ctx.text });
        const item = data.result;
        const caption =
          `*${item.title}*\nChannel: ${item.author || 'Unknown'}\nDuration: ${item.duration || 'Unknown'}\nViews: ${item.views ?? 'Unknown'}\nURL: ${item.url}\n\n` +
          `Use ${ctx.settings.prefix}song ${ctx.text} or ${ctx.settings.prefix}video ${ctx.text}`;

        if (item.thumbnail) {
          await ctx.sock.sendMessage(ctx.chatId, { image: { url: item.thumbnail }, caption }, { quoted: ctx.message });
        } else {
          await ctx.reply(caption);
        }
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  },
  {
    name: 'song',
    aliases: ['ytmp3', 'audio'],
    category: 'cod3-api-shortcuts',
    description: 'Download YouTube audio through cod3uchiha.com.',
    usage: '<query>',
    async run(ctx) {
      if (!ctx.text) return ctx.reply(`Usage: ${ctx.settings.prefix}song <query>`);
      try {
        await ctx.reply('T is preparing the audio...');
        const search = await getJson('/downloaders/play', { query: ctx.text });
        const item = search.result;
        const converted = await getJsonUrl(item.audioApi);
        const mediaUrl = findUrl(converted, ['url', 'downloadURL', 'downloadUrl', 'audio']);
        if (!mediaUrl) throw new Error('TKM-API returned no downloadable audio URL.');

        await ctx.sock.sendMessage(
          ctx.chatId,
          {
            audio: { url: mediaUrl },
            mimetype: 'audio/mpeg',
            fileName: `${cleanFilename(item.title || 'T-audio')}.mp3`
          },
          { quoted: ctx.message }
        );
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  },
  {
    name: 'video',
    aliases: ['ytmp4'],
    category: 'cod3-api-shortcuts',
    description: 'Download YouTube video through cod3uchiha.com.',
    usage: '<query>',
    async run(ctx) {
      if (!ctx.text) return ctx.reply(`Usage: ${ctx.settings.prefix}video <query>`);
      try {
        await ctx.reply('T is preparing the video...');
        const search = await getJson('/downloaders/play', { query: ctx.text });
        const item = search.result;
        const converted = await getJsonUrl(item.videoApi);
        const mediaUrl = findUrl(converted, ['url', 'downloadURL', 'downloadUrl', 'video']);
        if (!mediaUrl) throw new Error('TKM-API returned no downloadable video URL.');

        await ctx.sock.sendMessage(
          ctx.chatId,
          { video: { url: mediaUrl }, caption: item.title || 'T video', mimetype: 'video/mp4' },
          { quoted: ctx.message }
        );
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  }
];

commands.push(...baseCommands);

function rebuildCommandMap() {
  commandMap.clear();
  for (const command of commands) {
    for (const name of [command.name, ...(command.aliases || [])]) {
      const key = String(name).toLowerCase();
      if (!key || commandMap.has(key)) continue;
      commandMap.set(key, command);
    }
  }
}

function makeDynamicCommand(endpoint, aliases = []) {
  const routeCommand = slug(endpoint.route.replace(/^\//, '').replaceAll('/', '-'));
  return {
    name: routeCommand,
    aliases,
    category: `api-${slug(endpoint.category) || 'other'}`,
    description: endpoint.description,
    usage: endpointUsage(endpoint),
    dynamicApi: true,
    endpoint,
    async run(ctx) {
      const values = parseEndpointParams(ctx.text, endpoint);
      const missing = missingRequiredParams(endpoint, values);
      if (missing.length) {
        const usage = endpointUsage(endpoint);
        return ctx.reply(
          `Missing: ${missing.join(', ')}\nUsage: ${ctx.settings.prefix}${routeCommand}${usage ? ` ${usage}` : ''}\nRoute: ${endpoint.route}`
        );
      }

      try {
        const response = await requestEndpoint(endpoint, values);
        await sendEndpointResponse(ctx, endpoint, response);
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  };
}

async function refreshApiCommands({ force = false } = {}) {
  const catalog = await getCatalog({ force });
  const staticCommands = commands.filter((command) => !command.dynamicApi);
  const reserved = new Set();
  for (const command of staticCommands) {
    for (const name of [command.name, ...(command.aliases || [])]) reserved.add(String(name).toLowerCase());
  }

  const baseNameCounts = new Map();
  const displayNameCounts = new Map();
  for (const endpoint of catalog.endpoints) {
    const baseName = slug(endpoint.route.split('/').filter(Boolean).at(-1));
    const displayName = slug(endpoint.displayName);
    const routeCommand = slug(endpoint.route.replace(/^\//, '').replaceAll('/', '-'));
    if (routeCommand) reserved.add(routeCommand);
    baseNameCounts.set(baseName, (baseNameCounts.get(baseName) || 0) + 1);
    displayNameCounts.set(displayName, (displayNameCounts.get(displayName) || 0) + 1);
  }

  const dynamicCommands = catalog.endpoints.map((endpoint) => {
    const aliases = [];
    const baseName = slug(endpoint.route.split('/').filter(Boolean).at(-1));
    const displayName = slug(endpoint.displayName);

    if (baseName && baseNameCounts.get(baseName) === 1 && !reserved.has(baseName)) {
      aliases.push(baseName);
      reserved.add(baseName);
    }
    if (
      displayName &&
      displayName !== baseName &&
      displayNameCounts.get(displayName) === 1 &&
      !reserved.has(displayName)
    ) {
      aliases.push(displayName);
      reserved.add(displayName);
    }

    return makeDynamicCommand(endpoint, aliases);
  });

  commands.splice(0, commands.length, ...staticCommands, ...dynamicCommands);
  dynamicCount = dynamicCommands.length;
  lastCatalogRefresh = catalog.fetchedAt;
  rebuildCommandMap();
  return dynamicCount;
}

rebuildCommandMap();

module.exports = {
  commands,
  commandMap,
  refreshApiCommands
};
