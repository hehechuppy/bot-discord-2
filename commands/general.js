const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Nhại lại câu nói của bạn!')
        .addStringOption(option =>
            option.setName('noidung')
                .setDescription('Nội dung bạn muốn bot nói')
                .setRequired(true)),
    async execute(interaction) {
        const noiDung = interaction.options.getString('noidung');
        await interaction.reply({ content: `Bạn vừa bắt bot nói: **${noiDung}**` });
    }
};
