const { getJson, getMediaFromApiUrl, commandArgument, safeName, formatError } = require('../lib/tkmApi');

async function playCommand(sock, chatId, message) {
    const query = commandArgument(message);
    if (!query) {
        return sock.sendMessage(chatId, { text: 'Usage: .play <song name or YouTube URL>' }, { quoted: message });
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
        console.error('[PLAY] command error:', error);
        await sock.sendMessage(chatId, { text: formatError(error) }, { quoted: message });
    }
}

module.exports = playCommand;
