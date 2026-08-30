const { EmbedBuilder } = require('discord.js');
const { loadBirthdays, saveBirthdays } = require('../utils/birthdayScheduler');

const afkMap = new Map();

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;

        const userId = message.author.id;
        const content = message.content.trim();

        // --- XỬ LÝ AFK ---
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

        const contentLower = content.toLowerCase();

        // --- LỆNH CHÁT AFK THƯỜNG ---
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

        // --- XỬ LÝ LỆNH SINH NHẬT DÙNG DẤU CHẤM (.) ---
        if (contentLower.startsWith('.birthday') || contentLower.startsWith('.sinhnhat')) {
            const args = content.split(/ +/).slice(1);
            const sub = args[0] ? args[0].toLowerCase() : null;
            const birthdays = loadBirthdays();

            // .birthday set [ngày] [tháng]
            if (sub === 'set') {
                const day = parseInt(args[1]);
                const month = parseInt(args[2]);

                if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
                    return message.reply('❌ Cú pháp sai! Vui lòng dùng: `.birthday set [ngày] [tháng]` (Ví dụ: `.birthday set 15 8`)');
                }

                birthdays[userId] = { day, month };
                saveBirthdays(birthdays);
                return message.reply(`🎂 Đã lưu ngày sinh nhật của bạn: **${day}/${month}**!`);
            }

            // .birthday list
            if (sub === 'list') {
                const entries = Object.entries(birthdays);
                if (entries.length === 0) {
                    return message.reply('Chưa có ai đăng ký ngày sinh nhật!');
                }

                let listText = '';
                for (const [id, info] of entries) {
                    listText += `<@${id}>: **${info.day}/${info.month}**\n`;
                }

                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🎂 DANH SÁCH SINH NHẬT')
                    .setDescription(listText);

                return message.reply({ embeds: [embed] });
            }

            // .birthday remove
            if (sub === 'remove') {
                if (!birthdays[userId]) {
                    return message.reply('Bạn chưa cài đặt sinh nhật!');
                }
                delete birthdays[userId];
                saveBirthdays(birthdays);
                return message.reply('✅ Đã xóa thông tin sinh nhật của bạn!');
            }

            return message.reply('❌ Lệnh không hợp lệ! Dùng: `.birthday set [ngày] [tháng]`, `.birthday list`, hoặc `.birthday remove`.');
        }

        // Câu thoại tự động
        if (contentLower === 'ping') message.reply('Pong! 🏓');
        if (contentLower === 'xin chào') message.channel.send(`Chào ${message.author.username}! Mình có thể giúp gì cho bạn?`);
        if (contentLower === 'cảm ơn') message.channel.send(`Không có gì đâu ${message.author.username}!`);
        if (contentLower === 'ê') message.reply('ê cái gì mà ê');
    }
};
