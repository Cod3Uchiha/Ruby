const { getJson, formatError } = require('../lib/tkmApi');

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
