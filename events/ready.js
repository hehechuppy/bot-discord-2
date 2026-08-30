const { REST, Routes } = require('discord.js');
const { scheduleBirthdayCheck } = require('../utils/birthdayScheduler');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Bot đã đăng nhập thành công dưới tên: ${client.user.tag}`);

        const commandsData = Array.from(client.commands.values()).map(cmd => cmd.data.toJSON());

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            console.log('Đang cập nhật danh sách lệnh gạch chéo (/)...');
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commandsData }
            );
            console.log('Đăng ký lại danh sách Slash Command thành công!');
        } catch (error) {
            console.error(error);
        }

        scheduleBirthdayCheck(client);
    }
};
