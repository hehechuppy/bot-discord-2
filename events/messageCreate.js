const afkMap = new Map();

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;

        const userId = message.author.id;
        const contentLower = message.content.toLowerCase();

        if (afkMap.has(userId)) {
            const afkData = afkMap.get(userId);
            afkMap.delete(userId);

            if (message.member) {
                await message.member.setNickname(afkData.oldName).catch(() => {});
            }

            const replyMsg = await message.reply(`🎉 Chào mừng trở lại, **${message.author.username}**! Đã gỡ trạng thái AFK.`);
            setTimeout(() => replyMsg.delete().catch(() => {}), 5000); 
        }

        if (message.mentions.users.size > 0) {
            message.mentions.users.forEach(user => {
                if (afkMap.has(user.id)) {
                    const afkData = afkMap.get(user.id);
                    message.reply(`💤 **${user.username}** hiện đang AFK!\n📝 Lý do: *${afkData.reason}*`);
                }
            });
        }

        if (contentLower.startsWith('.afk') || contentLower.startsWith('?afk')) {
            const args = message.content.split(' ').slice(1);
            const reason = args.join(' ') || 'Không có lý do';

            const member = message.member;
            const oldName = member ? member.displayName : message.author.username;

            afkMap.set(userId, { reason, oldName, time: Date.now() });

            if (member) {
                const newNickname = `[AFK] ${oldName}`.substring(0, 32);
                await member.setNickname(newNickname).catch(() => {});
            }

            return message.reply(`💤 **${message.author.username}** đã bật AFK!\n📝 Lý do: **${reason}**`);
        }

        if (contentLower === 'ping') message.reply('Pong! 🏓');
        if (contentLower === 'xin chào') message.channel.send(`Chào ${message.author.username}! Mình có thể giúp gì cho bạn?`);
        if (contentLower === 'cảm ơn') message.channel.send(`Không có gì đâu ${message.author.username}!`);
        if (contentLower === 'ê') message.reply('ê cái gì mà ê');
    }
};
