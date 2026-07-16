const sharp = require('sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const {
  API_BASE_URL,
  getJson,
  getJsonUrl,
  getBuffer,
  findUrl,
  formatApiError
} = require('./api');

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

const commands = [
  {
    name: 'menu',
    aliases: ['help', 'commands'],
    category: 'general',
    description: 'Show every command.',
    async run(ctx) {
      const grouped = new Map();
      for (const command of commands) {
        const category = command.category || 'other';
        if (!grouped.has(category)) grouped.set(category, []);
        grouped.get(category).push(command);
      }

      const sections = [...grouped.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, items]) => {
          const rows = items
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => `${ctx.settings.prefix}${item.name}${item.usage ? ` ${item.usage}` : ''} — ${item.description}`)
            .join('\n');
          return `*${category.toUpperCase()}*\n${rows}`;
        });

      await ctx.reply(`*T*\n\n${sections.join('\n\n')}\n\nAPI: ${API_BASE_URL}`);
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
      await ctx.reply(`T is online.\nExternal API: ${API_BASE_URL}`);
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
    description: 'Show the API used by T.',
    async run(ctx) {
      await ctx.reply(`T uses only:\n${API_BASE_URL}\n\nCatalog:\n${API_BASE_URL}/catalog`);
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
    category: 'cod3-api',
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
    category: 'cod3-api',
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
            fileName: `${item.title || 'T-audio'}.mp3`
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
    category: 'cod3-api',
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
          {
            video: { url: mediaUrl },
            caption: item.title || 'T video',
            mimetype: 'video/mp4'
          },
          { quoted: ctx.message }
        );
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  },
  {
    name: 'tiktok',
    aliases: ['tt', 'tiktokdl'],
    category: 'cod3-api',
    description: 'Download TikTok through cod3uchiha.com.',
    usage: '<url>',
    async run(ctx) {
      const url = ctx.args[0];
      if (!url) return ctx.reply(`Usage: ${ctx.settings.prefix}tiktok <URL>`);
      try {
        const data = await getJson('/downloaders/tiktokdl', { url });
        const item = data.result;
        await ctx.sock.sendMessage(
          ctx.chatId,
          {
            video: { url: item.noWatermark || item.standard },
            caption: `${item.title || 'TikTok video'}\nAuthor: ${item.author || 'Unknown'}`
          },
          { quoted: ctx.message }
        );
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  },
  {
    name: 'image',
    aliases: ['img', 'imagesearch'],
    category: 'cod3-api',
    description: 'Search reusable images through cod3uchiha.com.',
    usage: '<query>',
    async run(ctx) {
      if (!ctx.text) return ctx.reply(`Usage: ${ctx.settings.prefix}image <query>`);
      try {
        const data = await getJson('/downloaders/img', { text: ctx.text, limit: 8 });
        const imageUrl = findUrl(data.result || data, ['url', 'originalUrl', 'thumbnail']);
        if (!imageUrl) throw new Error('TKM-API returned no image.');
        await ctx.sock.sendMessage(
          ctx.chatId,
          { image: { url: imageUrl }, caption: `Image result for: ${ctx.text}` },
          { quoted: ctx.message }
        );
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  },
  {
    name: 'pinterest',
    aliases: ['pint'],
    category: 'cod3-api',
    description: 'Search Pinterest through cod3uchiha.com.',
    usage: '<query>',
    async run(ctx) {
      if (!ctx.text) return ctx.reply(`Usage: ${ctx.settings.prefix}pinterest <query>`);
      try {
        const { buffer } = await getBuffer('/downloaders/pint', { text: ctx.text });
        await ctx.sock.sendMessage(
          ctx.chatId,
          { image: buffer, caption: `Pinterest result for: ${ctx.text}` },
          { quoted: ctx.message }
        );
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  },
  {
    name: 'translate',
    aliases: ['trt'],
    category: 'cod3-api',
    description: 'Translate text through cod3uchiha.com.',
    usage: '<language-code> <text>',
    async run(ctx) {
      const [language, ...parts] = ctx.args;
      const text = parts.join(' ').trim();
      if (!language || !text) {
        return ctx.reply(`Usage: ${ctx.settings.prefix}translate sn How are you?`);
      }
      try {
        const data = await getJson('/tools/trt', { text, language });
        await ctx.reply(`*Translation*\nFrom: ${data.from || 'auto'}\nTo: ${data.language || data.to}\n\n${data.result}`);
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  },
  {
    name: 'emojimix',
    category: 'cod3-api',
    description: 'Combine emojis through cod3uchiha.com.',
    usage: '<emoji1> <emoji2>',
    async run(ctx) {
      const [emoji1, emoji2] = ctx.args;
      if (!emoji1 || !emoji2) return ctx.reply(`Usage: ${ctx.settings.prefix}emojimix 🔥 😎`);
      try {
        const { buffer } = await getBuffer('/tools/emojimix', { emoji1, emoji2 });
        await ctx.sock.sendMessage(
          ctx.chatId,
          {
            document: buffer,
            mimetype: 'image/svg+xml',
            fileName: 'T-emojimix.svg',
            caption: `${emoji1} + ${emoji2}`
          },
          { quoted: ctx.message }
        );
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  },
  {
    name: 'imagine',
    aliases: ['flux', 'generate'],
    category: 'cod3-api',
    description: 'Generate an image through cod3uchiha.com.',
    usage: '<prompt>',
    async run(ctx) {
      if (!ctx.text) return ctx.reply(`Usage: ${ctx.settings.prefix}imagine <prompt>`);
      try {
        await ctx.reply('T is generating the image...');
        const { buffer } = await getBuffer('/ai/FluxLora', {
          prompt: ctx.text,
          width: 1024,
          height: 1024
        });
        await ctx.sock.sendMessage(ctx.chatId, { image: buffer, caption: ctx.text }, { quoted: ctx.message });
      } catch (error) {
        await ctx.reply(formatApiError(error));
      }
    }
  }
];

function buildCommandMap() {
  const map = new Map();
  for (const command of commands) {
    for (const name of [command.name, ...(command.aliases || [])]) {
      const key = String(name).toLowerCase();
      if (map.has(key)) throw new Error(`Duplicate command name: ${key}`);
      map.set(key, command);
    }
  }
  return map;
}

module.exports = {
  commands,
  commandMap: buildCommandMap()
};
