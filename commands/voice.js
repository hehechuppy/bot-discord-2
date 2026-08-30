const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('join')
            .setDescription('Cho bot vào kênh voice bạn đang ở và ở lại đó'),
        async execute(interaction) {
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
            .setDescription('Cho bot rời khỏi kênh voice hiện tại'),
        async execute(interaction) {
            const connection = getVoiceConnection(interaction.guildId);
            if (!connection) {
                return interaction.reply({ content: '❌ Bot hiện không ở trong kênh voice nào!', ephemeral: true });
            }
            connection.destroy();
            return interaction.reply({ content: '👋 Đã rời khỏi kênh voice!' });
        }
    }
];
