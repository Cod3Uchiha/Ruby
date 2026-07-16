require('dotenv').config();

const fs = require('node:fs');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');

const settings = require('./settings');
const { commands, commandMap } = require('./commands');

const logger = pino({ level: settings.logLevel });
let reconnectTimer = null;

function normalizeJid(jid = '') {
  return String(jid).replace(/:\d+@/, '@');
}

function numberFromJid(jid = '') {
  return normalizeJid(jid).split('@')[0].replace(/\D/g, '');
}

function unwrapMessage(content) {
  let current = content;
  for (let index = 0; index < 5 && current; index += 1) {
    if (current.ephemeralMessage?.message) current = current.ephemeralMessage.message;
    else if (current.viewOnceMessage?.message) current = current.viewOnceMessage.message;
    else if (current.viewOnceMessageV2?.message) current = current.viewOnceMessageV2.message;
    else if (current.documentWithCaptionMessage?.message) current = current.documentWithCaptionMessage.message;
    else break;
  }
  return current;
}

function extractText(message) {
  const content = unwrapMessage(message.message);
  return (
    content?.conversation ||
    content?.extendedTextMessage?.text ||
    content?.imageMessage?.caption ||
    content?.videoMessage?.caption ||
    content?.documentMessage?.caption ||
    content?.buttonsResponseMessage?.selectedButtonId ||
    content?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    content?.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim();
}

async function createContext(sock, message, command, args) {
  const chatId = message.key.remoteJid;
  const senderId = normalizeJid(message.key.participant || message.key.remoteJid);
  const isGroup = chatId.endsWith('@g.us');

  let metadata = null;
  let participants = [];
  let senderIsAdmin = false;
  let botIsAdmin = false;

  if (isGroup) {
    metadata = await sock.groupMetadata(chatId);
    participants = metadata.participants || [];
    const sender = participants.find((item) => normalizeJid(item.id) === senderId);
    const botId = normalizeJid(sock.user?.id);
    const bot = participants.find((item) => normalizeJid(item.id) === botId);
    senderIsAdmin = Boolean(sender?.admin);
    botIsAdmin = Boolean(bot?.admin);
  }

  const senderNumber = numberFromJid(senderId);
  const isOwner =
    Boolean(message.key.fromMe) ||
    Boolean(settings.ownerNumber && senderNumber === settings.ownerNumber);

  const reply = (text, extra = {}) =>
    sock.sendMessage(chatId, { text: String(text), ...extra }, { quoted: message });

  return {
    sock,
    message,
    command,
    commands,
    args,
    text: args.join(' ').trim(),
    chatId,
    senderId,
    senderNumber,
    isGroup,
    isOwner,
    senderIsAdmin,
    botIsAdmin,
    metadata,
    participants,
    settings,
    logger,
    reply,
    normalizeJid,
    numberFromJid
  };
}

async function enforcePermissions(ctx) {
  if (ctx.command.groupOnly && !ctx.isGroup) {
    await ctx.reply('This command only works in groups.');
    return false;
  }

  if (ctx.command.adminOnly && !ctx.senderIsAdmin && !ctx.isOwner) {
    await ctx.reply('Only a group administrator can use this command.');
    return false;
  }

  if (ctx.command.botAdmin && !ctx.botIsAdmin) {
    await ctx.reply('T must be a group administrator to use this command.');
    return false;
  }

  if (ctx.command.ownerOnly && !ctx.isOwner) {
    await ctx.reply('Only the bot owner can use this command.');
    return false;
  }

  return true;
}

async function handleMessage(sock, message) {
  if (!message?.message || message.key.remoteJid === 'status@broadcast') return;

  message.message = unwrapMessage(message.message);
  const body = extractText(message);
  if (!body.startsWith(settings.prefix)) return;

  const input = body.slice(settings.prefix.length).trim();
  if (!input) return;

  const [name, ...args] = input.split(/\s+/);
  const command = commandMap.get(name.toLowerCase());
  if (!command) return;

  const ctx = await createContext(sock, message, command, args);
  if (!(await enforcePermissions(ctx))) return;

  try {
    await command.run(ctx);
  } catch (error) {
    console.error(`[${command.name}]`, error);
    await ctx.reply(`Command failed: ${error.message || 'Unknown error'}`);
  }
}

function disconnectCode(error) {
  if (!error) return undefined;
  return error?.output?.statusCode || new Boom(error).output.statusCode;
}

async function start() {
  fs.mkdirSync(settings.sessionDirectory, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(settings.sessionDirectory);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: !settings.pairingNumber,
    browser: settings.browser,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    markOnlineOnConnect: false,
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    getMessage: async () => undefined
  });

  sock.ev.on('creds.update', saveCreds);

  if (settings.pairingNumber && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(settings.pairingNumber);
        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
        console.log(`T pairing code: ${formatted}`);
      } catch (error) {
        console.error('Unable to create pairing code:', error.message);
      }
    }, 2_000);
  }

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) {
      await handleMessage(sock, message).catch((error) => {
        console.error('Message handler error:', error);
      });
    }
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log(`T connected as ${jidNormalizedUser(sock.user?.id || '')}`);
    }

    if (connection === 'close') {
      const statusCode = disconnectCode(lastDisconnect?.error);
      if (statusCode === DisconnectReason.loggedOut) {
        console.error('T was logged out. Delete the session folder and pair again.');
        return;
      }

      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => start().catch(console.error), 5_000);
    }
  });

  return sock;
}

process.on('unhandledRejection', (error) => console.error('Unhandled rejection:', error));
process.on('uncaughtException', (error) => console.error('Uncaught exception:', error));

start().catch((error) => {
  console.error('T failed to start:', error);
  process.exitCode = 1;
});
