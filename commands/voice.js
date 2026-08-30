const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const allowedRoleIds = ['1420260959913775155', '1420753551587807353', '1420262154271199283'];

function isAdmin(member) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return member.roles.cache.some(role => allowedRoleIds.includes(role.id));
}

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('join')
            .setDescription('Cho bot vào kênh voice bạn đang ở')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        async execute(interaction) {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: '🚫 Bạn không có quyền Admin để sử dụng lệnh này!', ephemeral: true });
            }

            const memberVoiceChannel = interaction.member.voice.channel;
            if (!memberVoiceChannel) {
                return interaction.reply({ content: '❌ Bạn cần đang ở trong 1 kênh voice để dùng lệnh này!', ephemeral: true });
            }

            try {
                joinVoiceChannel({
                    channelId: memberVoiceChannel.id,
                    guildId: memberVoiceChannel.guild.id,
                    adapterCreator: memberVoiceChannel.guild.voiceAdapterCreator,
                    selfDeaf: false
                });
                return interaction.reply({ content: `✅ Đã vào kênh voice **${memberVoiceChannel.name}**!` });
            } catch (error) {
                console.error(error);
                return interaction.reply({ content: '❌ Không thể vào kênh voice, kiểm tra lại quyền của bot!', ephemeral: true });
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('leave')
            .setDescription('Cho bot rời khỏi kênh voice hiện tại')
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
        async execute(interaction) {
            if (!isAdmin(interaction.member)) {
                return interaction.reply({ content: '🚫 Bạn không có quyền Admin để sử dụng lệnh này!', ephemeral: true });
            }

            const connection = getVoiceConnection(interaction.guildId);
            if (!connection) {
                return interaction.reply({ content: '❌ Bot hiện không ở trong kênh voice nào!', ephemeral: true });
            }
            connection.destroy();
            return interaction.reply({ content: '👋 Đã rời khỏi kênh voice!' });
        }
    }
];
