const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const BIRTHDAYS_FILE = path.join(__dirname, '..', 'birthdays.json');

function loadBirthdays() {
    if (!fs.existsSync(BIRTHDAYS_FILE)) {
        fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify({}), 'utf8');
        return {};
    }
    try {
        const data = fs.readFileSync(BIRTHDAYS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Lỗi khi đọc file birthdays.json:', err);
        return {};
    }
}

function saveBirthdays(data) {
    fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function parseTimeToMs(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.trim().match(/^(\d+)\s*([phdPHD])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'p': return value * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'd': return value * 24 * 60 * 60 * 1000;
        default: return null;
    }
}

function scheduleBirthdayCheck(client) {
    const checkBirthdays = async () => {
        const birthdays = loadBirthdays();
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;

        for (const [userId, info] of Object.entries(birthdays)) {
            if (info.day === day && info.month === month) {
                client.guilds.cache.forEach(async (guild) => {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            const systemChannel = guild.systemChannel || guild.channels.cache.find(c => c.isTextBased() && c.permissionsFor(guild.members.me).has('SendMessages'));
                            if (systemChannel) {
                                const embed = new EmbedBuilder()
                                    .setColor('#FF69B4')
                                    .setTitle('🎉 CHÚC MỪNG SINH NHẬT! 🎂')
                                    .setDescription(`Hôm nay là sinh nhật của **${member.user.tag}** (${info.day}/${info.month})!\nChúc bạn có một ngày sinh nhật thật vui vẻ và hạnh phúc! 🎈✨`)
                                    .setThumbnail(member.user.displayAvatarURL());
                                systemChannel.send({ content: `🎉 <@${userId}>`, embeds: [embed] });
                            }
                        }
                    } catch (err) {
                        console.error(`Lỗi khi chúc mừng sinh nhật user ${userId}:`, err);
                    }
                });
            }
        }
    };

    checkBirthdays();
    setInterval(checkBirthdays, 24 * 60 * 60 * 1000);
}

module.exports = { loadBirthdays, saveBirthdays, parseTimeToMs, scheduleBirthdayCheck };
