const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// Hàm chuyển đổi thời gian (10p, 2h, 1d) sang milliseconds
function parseTimeToMs(str) {
    if (!str) return null;
    const match = str.match(/^(\d+)([phd])$/i);
    if (!match) return null;
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === 'p') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    return null;
}

const allowedRoleIds = [
    '1420260959913775155', 
    '1420753551587807353', 
    '1420262154271199283'
];

function isAdmin(member) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return member.roles.cache.some(role => allowedRoleIds.includes(role.id));
}

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('clear')
            .setDescription('Xóa một số lượng tin nhắn trong kênh')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addIntegerOption(option =>
                option.setName('soluong')
                    .setDescription('Số lượng tin nhắn muốn xóa (từ 1 đến 100)')
                    .setRequired(true)),
        async execute(interaction) {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: '🚫 Bạn cần có quyền Administrator hoặc Role Admin để dùng lệnh này!', ephemeral: true });
            }
            const count = interaction.options.getInteger('soluong');
            if (count < 1 || count > 100) {
                return interaction.reply({ content: 'Bạn chỉ có thể xóa từ 1 đến 100 tin nhắn!', ephemeral: true });
            }
            try {
                await interaction.channel.bulkDelete(count, true);
                await interaction.reply({ content: `Đã xóa thành công ${count} tin nhắn!`, ephemeral: true });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Có lỗi xảy ra khi xóa tin nhắn!', ephemeral: true });
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('mute')
            .setDescription('Mute người dùng trong server')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addUserOption(option => option.setName('target').setDescription('Người bạn muốn mute').setRequired(true))
            .addIntegerOption(option => option.setName('time').setDescription('Thời gian mute (tính bằng phút)').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('Lý do mute')),
        async execute(interaction) {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: '🚫 Bạn cần có quyền Administrator hoặc Role Admin để dùng lệnh này!', ephemeral: true });
            }
            const user = interaction.options.getMember('target');
            const minutes = interaction.options.getInteger('time');
            const reason = interaction.options.getString('reason') || 'Không có lý do';

            if (!user) return interaction.reply({ content: 'Không tìm thấy người dùng!', ephemeral: true });

            try {
                await user.timeout(minutes * 60 * 1000, reason);
                await interaction.reply({ content: `✅ Đã mute **${user.user.tag}** trong **${minutes} phút**. Lý do: ${reason}` });
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Không thể mute người này!', ephemeral: true });
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('camchat')
            .setDescription('Cấm người dùng nhắn tin trong 1 kênh cụ thể')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addUserOption(option => option.setName('target').setDescription('Người muốn cấm chat').setRequired(true))
            .addStringOption(option => option.setName('thoigian').setDescription('Thời gian cấm (VD: 10p, 2h, 1d). Bỏ trống = cấm vĩnh viễn'))
            .addChannelOption(option => option.setName('kenh').setDescription('Kênh muốn cấm (để trống nếu muốn cấm ở kênh hiện tại)'))
            .addStringOption(option => option.setName('lydo').setDescription('Lý do cấm chat')),
        async execute(interaction) {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: '🚫 Bạn cần có quyền Administrator hoặc Role Admin để dùng lệnh này!', ephemeral: true });
            }

            const targetMember = interaction.options.getMember('target');
            const timeInput = interaction.options.getString('thoigian');
            const targetChannel = interaction.options.getChannel('kenh') || interaction.channel;
            const reason = interaction.options.getString('lydo') || 'Không có lý do';

            if (!targetMember) return interaction.reply({ content: '❌ Không tìm thấy người dùng này!', ephemeral: true });

            let durationMs = null;
            if (timeInput) {
                durationMs = parseTimeToMs(timeInput);
                if (!durationMs) {
                    return interaction.reply({ content: '❌ Định dạng thời gian không hợp lệ! Vui lòng dùng: p, h, d.', ephemeral: true });
                }
            }

            try {
                await targetChannel.permissionOverwrites.edit(targetMember, { SendMessages: false }, { reason });
                const timeDisplay = timeInput ? `trong **${timeInput}**` : '**vĩnh viễn**';
                await interaction.reply({ content: `🚫 Đã cấm **${targetMember.user.tag}** nhắn tin tại kênh ${targetChannel} ${timeDisplay}!\n📝 **Lý do:** ${reason}` });

                if (durationMs) {
                    setTimeout(async () => {
                        try {
                            await targetChannel.permissionOverwrites.edit(targetMember, { SendMessages: null });
                            await targetChannel.send(`📢 **${targetMember.user.tag}** đã hết thời gian cấm chat!`);
                        } catch (err) {
                            console.error('Lỗi gỡ cấm chat:', err);
                        }
                    }, durationMs);
                }
            } catch (error) {
                console.error(error);
                return interaction.reply({ content: '❌ Không thể cấm chat! Kiểm tra lại quyền của Bot.', ephemeral: true });
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('uncamchat')
            .setDescription('Hủy cấm chat người dùng trong 1 kênh cụ thể')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addUserOption(option => option.setName('target').setDescription('Người muốn gỡ cấm chat').setRequired(true))
            .addChannelOption(option => option.setName('kenh').setDescription('Kênh muốn gỡ cấm (để trống nếu là kênh hiện tại)')),
        async execute(interaction) {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: '🚫 Bạn cần có quyền Administrator hoặc Role Admin để dùng lệnh này!', ephemeral: true });
            }

            const targetMember = interaction.options.getMember('target');
            const targetChannel = interaction.options.getChannel('kenh') || interaction.channel;

            if (!targetMember) return interaction.reply({ content: '❌ Không tìm thấy người dùng!', ephemeral: true });

            try {
                await targetChannel.permissionOverwrites.edit(targetMember, { SendMessages: null });
                return interaction.reply({ content: `✅ Đã gỡ cấm nhắn tin cho **${targetMember.user.tag}** tại kênh ${targetChannel}!` });
            } catch (error) {
                console.error(error);
                return interaction.reply({ content: '❌ Không thể gỡ cấm chat!', ephemeral: true });
            }
        }
    }
];
