const { scheduleBirthdayCheck } = require('../utils/birthdayScheduler');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Bot đã đăng nhập thành công dưới tên: ${client.user.tag}`);
        scheduleBirthdayCheck(client);
    }
};
