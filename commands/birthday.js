const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { loadBirthdays, saveBirthdays } = require('../utils/birthdayScheduler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Quản lý thông tin sinh nhật')
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Cài đặt ngày sinh nhật của bạn')
                .addIntegerOption(opt => opt.setName('ngay').setDescription('Ngày sinh (1-31)').setRequired(true))
                .addIntegerOption(opt => opt.setName('thang').setDescription('Tháng sinh (1-12)').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('Xem danh sách sinh nhật trong server'))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Xóa thông tin sinh nhật của bạn')),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const birthdays = loadBirthdays();

        if (subcommand === 'set') {
            const day = interaction.options.getInteger('ngay');
            const month = interaction.options.getInteger('thang');

            if (day < 1 || day > 31 || month < 1 || month > 12) {
                return interaction.reply({ content: '❌ Ngày hoặc tháng không hợp lệ!', ephemeral: true });
            }

            birthdays[interaction.user.id] = { day, month };
            saveBirthdays(birthdays);

            return interaction.reply({ content: `🎂 Đã lưu ngày sinh nhật của bạn: **${day}/${month}**!`, ephemeral: true });
        }

        if (subcommand === 'list') {
            const entries = Object.entries(birthdays);
            if (entries.length === 0) {
                return interaction.reply({ content: 'Chưa có ai đăng ký ngày sinh nhật!', ephemeral: true });
            }

            let listText = '';
            for (const [userId, info] of entries) {
                listText += `<@${userId}>: **${info.day}/${info.month}**\n`;
            }

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('🎂 DANH SÁCH SINH NHẬT')
                .setDescription(listText);

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'remove') {
            if (!birthdays[interaction.user.id]) {
                return interaction.reply({ content: 'Bạn chưa cài đặt sinh nhật!', ephemeral: true });
            }

            delete birthdays[interaction.user.id];
            saveBirthdays(birthdays);

            return interaction.reply({ content: '✅ Đã xóa thông tin sinh nhật của bạn!', ephemeral: true });
        }
    }
};
