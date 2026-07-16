const { getJson, commandArgument, formatError } = require('../lib/tkmApi');
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
