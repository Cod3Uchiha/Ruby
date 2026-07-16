const sharp = require('sharp');
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
