const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const { loadBirthdays, saveBirthdays, parseTimeToMs } = require('../utils/birthdayScheduler');

const allowedRoleIds = [
    '1420260959913775155', 
    '1420753551587807353', 
    '1420262154271199283'
];

const afkMap = new Map();

function checkRole(member) {
    return member.roles.cache.some(role => allowedRoleIds.includes(role.id));
}

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

        // --- XỬ LÝ CHÁT THƯỜNG ---
        const contentLower = content.toLowerCase();
        if (contentLower === 'ping') return message.reply('Pong! 🏓');
        if (contentLower === 'xin chào') return message.channel.send(`Chào ${message.author.username}! Mình có thể giúp gì cho bạn?`);
        if (contentLower === 'cảm ơn') return message.channel.send(`Không có gì đâu ${message.author.username}!`);
        if (contentLower === 'ê') return message.reply('ê cái gì mà ê');

        // CHỈ XỬ LÝ CÁC LỆNH BẮT ĐẦU BẰNG DẤU CHẤM (.) HOẶC ?
        if (!content.startsWith('.') && !content.startsWith('?')) return;

        const args = content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // 1. LỆNH .afk
        if (command === 'afk') {
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

        // 2. LỆNH .say [nội dung]
        if (command === 'say') {
            const text = args.join(' ');
            if (!text) return message.reply('❌ Vui lòng nhập nội dung! Ví dụ: `.say Hello`');
            return message.reply(`Bạn vừa bắt bot nói: **${text}**`);
        }

        // 3. LỆNH .birthday [set/list/remove]
        if (command === 'birthday' || command === 'sinhnhat') {
            const sub = args[0] ? args[0].toLowerCase() : null;
            const birthdays = loadBirthdays();

            if (sub === 'set') {
                const day = parseInt(args[1]);
                const month = parseInt(args[2]);

                if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
                    return message.reply('❌ Cú pháp sai! Sử dụng: `.birthday set [ngày] [tháng]` (Ví dụ: `.birthday set 15 8`)');
                }

                birthdays[userId] = { day, month };
                saveBirthdays(birthdays);
                return message.reply(`🎂 Đã lưu ngày sinh nhật của bạn: **${day}/${month}**!`);
            }

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

        // 4. LỆNH .menu
        if (command === 'menu') {
            if (!checkRole(message.member)) {
                return message.reply('🚫 Bạn không có Role được phép hiển thị Menu này!');
            }

            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle('🔥 DANH SÁCH SCRIPT HUB')
                .setDescription('Nhấn vào menu bên dưới để lấy thông tin Script bạn cần nhé!');

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('shop_menu')
                    .setPlaceholder('Nhấn vào đây để chọn Script Hub')
                    .addOptions([
                        { label: 'Hop Night Hub', description: 'Lấy script Hop Boss', value: 'hop night hub', emoji: '⚡' },
                        { label: 'Banana Fake', description: 'Lấy script Banana Fake', value: 'banana fake', emoji: '▶️' },
                        { label: 'Main Night Hub', description: 'Lấy script Main Night Hub', value: 'main night hub', emoji: '🎬' },
                        { label: 'Main Hoho Hub', description: 'Lấy script Main Hoho Hub', value: 'main hoho hub', emoji: '🔥' },
                        { label: 'Teddy Hub', description: 'Lấy script Teddy Hub', value: 'teddy hub', emoji: '🧸' },
                        { label: 'Trẩu V9', description: 'Lấy script Trẩu V9', value: 'trẩu v9', emoji: '😈' },
                        { label: 'Redz Fake', description: 'Lấy script Redz Fake', value: 'redz fake', emoji: '🔴' },
                        { label: 'Omg Hub', description: 'Lấy script Omg Hub', value: 'omg hub', emoji: '✨' },
                        { label: 'Fix Lag', description: 'Lấy script Fix Lag', value: 'fix lag', emoji: '🛠️' },
                        { label: 'Fly Gui V3', description: 'Lấy script Fly Gui V3', value: 'fly gui v3', emoji: '⚡' },
                        { label: 'Steal A Brainrot', description: 'Lấy script Steal A Brainrot', value: 'steal a Brainrot', emoji: '🧠' },
                        { label: 'Grow A Garden 2', description: 'Lấy script Grow A Garden 2', value: 'Grow a Garden 2', emoji: '🌱' },
                        { label: 'Forge Hub', description: 'Lấy script Forge Hub', value: 'Forge Hub', emoji: '🛠️' },
                        { label: 'Terror Hub', description: 'Lấy script Terror Hub', value: 'Terror hub', emoji: '💀' },
                        { label: 'Quantum Hub', description: 'Lấy script Quantum Hub', value: 'Quantum Hub', emoji: '🌌' }
                    ])
            );

            return message.reply({ embeds: [embed], components: [row] });
        }

        // 5. LỆNH .clear [số lượng]
        if (command === 'clear') {
            if (!checkRole(message.member)) {
                return message.reply('🚫 Bạn không có Role được phép sử dụng lệnh này!');
            }
            const count = parseInt(args[0]);
            if (!count || count < 1 || count > 100) {
                return message.reply('❌ Sử dụng: `.clear [số tin nhắn từ 1-100]`');
            }
            try {
                await message.channel.bulkDelete(count + 1, true);
                const replyMsg = await message.channel.send(`✅ Đã xóa ${count} tin nhắn!`);
                setTimeout(() => replyMsg.delete().catch(() => {}), 3000);
            } catch (error) {
                console.error(error);
                message.reply('Có lỗi xảy ra khi xóa tin nhắn!');
            }
        }

        // 6. LỆNH .mute [@user] [số phút] [lý do]
        if (command === 'mute') {
            if (!checkRole(message.member)) {
                return message.reply('🚫 Bạn không có Role được phép sử dụng lệnh này!');
            }
            const targetMember = message.mentions.members.first();
            const minutes = parseInt(args[1]);
            const reason = args.slice(2).join(' ') || 'Không có lý do';

            if (!targetMember || !minutes) {
                return message.reply('❌ Sử dụng: `.mute @User [số phút] [lý do]`');
            }

            try {
                await targetMember.timeout(minutes * 60 * 1000, reason);
                return message.reply(`✅ Đã mute **${targetMember.user.tag}** trong **${minutes} phút**. Lý do: ${reason}`);
            } catch (error) {
                return message.reply('❌ Không thể mute người này!');
            }
        }

        // 7. LỆNH .camchat [@user] [thời gian] [lý do]
        if (command === 'camchat') {
            if (!checkRole(message.member)) {
                return message.reply('🚫 Bạn không có Role được phép sử dụng lệnh này!');
            }
            const targetMember = message.mentions.members.first();
            if (!targetMember) return message.reply('❌ Sử dụng: `.camchat @User [thời gian (10p, 2h)] [lý do]`');

            const timeInput = args[1] && parseTimeToMs(args[1]) ? args[1] : null;
            const reasonIndex = timeInput ? 2 : 1;
            const reason = args.slice(reasonIndex).join(' ') || 'Không có lý do';
            const durationMs = timeInput ? parseTimeToMs(timeInput) : null;

            try {
                await message.channel.permissionOverwrites.edit(targetMember, { SendMessages: false }, { reason });
                const timeDisplay = timeInput ? `trong **${timeInput}**` : '**vĩnh viễn**';
                await message.reply(`🚫 Đã cấm **${targetMember.user.tag}** nhắn tin tại kênh này ${timeDisplay}!\n📝 **Lý do:** ${reason}`);

                if (durationMs) {
                    setTimeout(async () => {
                        try {
                            await message.channel.permissionOverwrites.edit(targetMember, { SendMessages: null });
                            await message.channel.send(`📢 **${targetMember.user.tag}** đã hết thời gian cấm chat!`);
                        } catch (err) {}
                    }, durationMs);
                }
            } catch (error) {
                return message.reply('❌ Không thể cấm chat!');
            }
        }

        // 8. LỆNH .uncamchat [@user]
        if (command === 'uncamchat') {
            if (!checkRole(message.member)) {
                return message.reply('🚫 Bạn không có Role được phép sử dụng lệnh này!');
            }
            const targetMember = message.mentions.members.first();
            if (!targetMember) return message.reply('❌ Sử dụng: `.uncamchat @User`');

            try {
                await message.channel.permissionOverwrites.edit(targetMember, { SendMessages: null });
                return message.reply(`✅ Đã gỡ cấm nhắn tin cho **${targetMember.user.tag}**!`);
            } catch (error) {
                return message.reply('❌ Không thể gỡ cấm chat!');
            }
        }

        // 9. LỆNH .join
        if (command === 'join') {
            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) return message.reply('❌ Bạn cần ở trong 1 kênh voice!');

            try {
                joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: voiceChannel.guild.id,
                    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                    selfDeaf: false
                });
                return message.reply(`✅ Đã vào kênh voice **${voiceChannel.name}**!`);
            } catch (error) {
                return message.reply('❌ Không thể vào kênh voice!');
            }
        }

        // 10. LỆNH .leave
        if (command === 'leave') {
            const connection = getVoiceConnection(message.guild.id);
            if (!connection) return message.reply('❌ Bot không ở trong kênh voice nào!');
            connection.destroy();
            return message.reply('👋 Đã rời khỏi kênh voice!');
        }
    }
};
