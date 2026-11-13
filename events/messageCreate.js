const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

const afkMap = new Map();

// ⚡ CẤU HÌNH EMOJI TỰ ĐỘNG
const AUTO_REACTION_CHANNELS = ['1512366354496225410'];
const REACTIONS = ['✅', '💀', '😏', '😭', '❌', '💙', '🌙', '🎁', '🎮', '⚡', '🎉', '👉🏻', '💬', '🛞', '🥵', '🆑', '☠️', '🌚'];

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;

        // 🎯 THÊM EMOJI TỰ ĐỘNG NẾU Ở CÁC KÊNH CHỈ ĐỊNH
        if (AUTO_REACTION_CHANNELS.includes(message.channel.id)) {
            for (const emoji of REACTIONS) {
                await message.react(emoji).catch(() => {});
            }
        }

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

        // --- LỆNH .lock VÀ .unlock (KHÓA TOÀN BỘ ROLE KÊNH CHAT) ---
        if (contentLower.startsWith('.lock') || contentLower.startsWith('.unlock')) {
            const allowedRoleIds = [
                '1420260959913775155', 
                '1420753551587807353', 
                '1420262154271199283'
            ];

            const member = message.member;
            if (!member) return;

            const hasAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
            const hasRole = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

            if (!hasAdmin && !hasRole) {
                return message.reply({ content: '🚫 Bạn cần có quyền Administrator hoặc Role Admin để dùng lệnh này!' });
            }

            const rolesToUpdate = message.guild.roles.cache.filter(role => 
                !role.permissions.has(PermissionFlagsBits.Administrator)
            );

            if (contentLower.startsWith('.lock')) {
                try {
                    for (const [_, role] of rolesToUpdate) {
                        await message.channel.permissionOverwrites.edit(role, { SendMessages: false }).catch(() => {});
                    }
                    return message.reply({ content: `🔒 Đã khóa thành công kênh ${message.channel} cho tất cả các Role!` });
                } catch (error) {
                    console.error(error);
                    return message.reply({ content: '❌ Không thể khóa kênh này! Kiểm tra lại quyền của Bot.' });
                }
            }

            if (contentLower.startsWith('.unlock')) {
                try {
                    for (const [_, role] of rolesToUpdate) {
                        await message.channel.permissionOverwrites.edit(role, { SendMessages: null }).catch(() => {});
                    }
                    return message.reply({ content: `🔓 Đã mở khóa thành công kênh ${message.channel}!` });
                } catch (error) {
                    console.error(error);
                    return message.reply({ content: '❌ Không thể mở khóa kênh này! Kiểm tra lại quyền của Bot.' });
                }
            }
        }

        // Câu thoại tự động
        if (contentLower === 'ping') message.reply('Pong! 🏓');
        if (contentLower === 'xin chào') message.channel.send(`Chào ${message.author.username}! Mình có thể giúp gì cho bạn?`);
        if (contentLower === 'cảm ơn') message.channel.send(`Không có gì đâu ${message.author.username}!`);
        if (contentLower === 'ê') message.reply('ê cái gì mà ê 😡');
        if (contentLower === 'tick') message.reply('tạo ticket ở đây <#1501567490679898244>🎟️');
    }
};
