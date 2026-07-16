const { getJson, getMediaFromApiUrl, commandArgument, safeName, formatError } = require('../lib/tkmApi');

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
