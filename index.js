require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    EmbedBuilder 
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const afkMap = new Map();
const PREFIX = '.'; // Prefix mặc định cho Bot

// --- QUẢN LÝ DỮ LIỆU SINH NHẬT ---
const BIRTHDAYS_FILE = path.join(__dirname, 'birthdays.json');

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

// Hàm hỗ trợ chuyển đổi chuỗi thời gian
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

// Lên lịch check sinh nhật mỗi ngày
function scheduleBirthdayCheck() {
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
                        console.error(`Lỗi chúc mừng sinh nhật user ${userId}:`, err);
                    }
                });
            }
        }
    };

    checkBirthdays();
    setInterval(checkBirthdays, 24 * 60 * 60 * 1000);
}

client.once('ready', () => {
    console.log(`Bot đã đăng nhập thành công dưới tên: ${client.user.tag}`);
    scheduleBirthdayCheck();
});

// XỬ LÝ LỆNH DÙNG PREFIX DẤU CHẤM (.)
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const content = message.content.trim();
    const contentLower = content.toLowerCase();

    // Xử lý AFK
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

    if (contentLower.startsWith('.afk') || contentLower.startsWith('?afk')) {
        const args = content.split(' ').slice(1);
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

    // Các phản hồi cơ bản
    if (contentLower === 'ping') return message.reply('Pong! 🏓');
    if (contentLower === 'xin chào') return message.channel.send(`Chào ${message.author.username}! Mình có thể giúp gì cho bạn?`);
    if (contentLower === 'cảm ơn') return message.channel.send(`Không có gì đâu ${message.author.username}!`);
    if (contentLower === 'ê') return message.reply('ê cái gì mà ê');

    // Kiểm tra nếu tin nhắn không bắt đầu bằng PREFIX thì bỏ qua
    if (!content.startsWith(PREFIX)) return;

    // Tách lệnh và tham số
    const args = content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // ID các Role có quyền dùng lệnh quản trị
    const allowedRoleIds = [
        '1420260959913775155', 
        '1420753551587807353', 
        '1420262154271199283'
    ];
    const hasRole = message.member ? message.member.roles.cache.some(role => allowedRoleIds.includes(role.id)) : false;

    // --- CÁC LỆNH DÙNG PREFIX . ---

    // 1. Bộ lệnh sinh nhật: .sinhnhat hoặc .birthday
    if (command === 'sinhnhat' || command === 'birthday') {
        const subCommand = args[0] ? args[0].toLowerCase() : 'help';
        const birthdays = loadBirthdays();

        // Subcommand: set (Cài đặt) -> Cú pháp: .sinhnhat set <ngày> <tháng>
        if (subCommand === 'set') {
            const day = parseInt(args[1]);
            const month = parseInt(args[2]);

            if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
                return message.reply('❌ Cú pháp không hợp lệ! Dùng: `.sinhnhat set <ngày> <tháng>` (VD: `.sinhnhat set 15 8`)');
            }

            birthdays[message.author.id] = { day, month };
            saveBirthdays(birthdays);

            return message.reply(`🎂 Đã lưu ngày sinh nhật của bạn: **${day}/${month}**!`);
        }

        // Subcommand: list (Xem danh sách) -> Cú pháp: .sinhnhat list
        if (subCommand === 'list') {
            const entries = Object.entries(birthdays);
            if (entries.length === 0) {
                return message.reply('Chưa có ai đăng ký ngày sinh nhật!');
            }

            let listText = '';
            for (const [uId, info] of entries) {
                listText += `<@${uId}>: **${info.day}/${info.month}**\n`;
            }

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('🎂 DANH SÁCH SINH NHẬT')
                .setDescription(listText);

            return message.channel.send({ embeds: [embed] });
        }

        // Subcommand: remove (Xóa) -> Cú pháp: .sinhnhat remove
        if (subCommand === 'remove' || subCommand === 'xoa') {
            if (!birthdays[message.author.id]) {
                return message.reply('Bạn chưa cài đặt sinh nhật!');
            }

            delete birthdays[message.author.id];
            saveBirthdays(birthdays);

            return message.reply('✅ Đã xóa thông tin sinh nhật của bạn!');
        }

        // Hướng dẫn cú pháp
        return message.reply('📌 **Hướng dẫn lệnh sinh nhật:**\n- `.sinhnhat set <ngày> <tháng>`: Đặt ngày sinh nhật\n- `.sinhnhat list`: Xem danh sách sinh nhật\n- `.sinhnhat remove`: Xóa sinh nhật của bạn');
    }

    // 2. Lệnh .say <nội dung>
    if (command === 'say') {
        const text = args.join(' ');
        if (!text) return message.reply('Vui lòng nhập nội dung muốn bot nói!');
        return message.channel.send(text);
    }

    // 3. Lệnh .clear <số lượng>
    if (command === 'clear') {
        if (!hasRole) return message.reply('🚫 Bạn không có quyền dùng lệnh này!');
        const count = parseInt(args[0]);
        if (!count || count < 1 || count > 100) return message.reply('Vui lòng nhập số lượng tin nhắn cần xóa (từ 1 đến 100)!');

        try {
            await message.channel.bulkDelete(count + 1, true); // +1 để xóa cả tin nhắn gọi lệnh
            const msg = await message.channel.send(`✅ Đã xóa thành công ${count} tin nhắn!`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        } catch (error) {
            console.error(error);
            return message.reply('Có lỗi xảy ra khi xóa tin nhắn!');
        }
    }

    // 4. Lệnh .mute <tag user> <số phút> [lý do]
    if (command === 'mute') {
        if (!hasRole) return message.reply('🚫 Bạn không có quyền dùng lệnh này!');
        const targetMember = message.mentions.members.first();
        const minutes = parseInt(args[1]);
        const reason = args.slice(2).join(' ') || 'Không có lý do';

        if (!targetMember || !minutes) return message.reply('Cú pháp sai! Dùng: `.mute @user <số_phút> [lý do]`');

        try {
            await targetMember.timeout(minutes * 60 * 1000, reason);
            return message.reply(`✅ Đã mute **${targetMember.user.tag}** trong **${minutes} phút**. Lý do: ${reason}`);
        } catch (err) {
            return message.reply('Không thể mute người này do thiếu quyền!');
        }
    }

    // 5. Lệnh .camchat <tag user> [thời gian] [lý do] (VD: .camchat @user 10p Lỗi chat rác)
    if (command === 'camchat') {
        if (!hasRole) return message.reply('🚫 Bạn không có quyền dùng lệnh này!');
        const targetMember = message.mentions.members.first();
        if (!targetMember) return message.reply('Cú pháp sai! Dùng: `.camchat @user [thời gian: 10p, 2h, 1d] [lý do]`');

        const timeInput = args[1] && parseTimeToMs(args[1]) ? args[1] : null;
        const reasonIndex = timeInput ? 2 : 1;
        const reason = args.slice(reasonIndex).join(' ') || 'Không có lý do';
        const durationMs = parseTimeToMs(timeInput);

        try {
            await message.channel.permissionOverwrites.edit(targetMember, { SendMessages: false }, { reason });
            const timeDisplay = timeInput ? `trong **${timeInput}**` : '**vĩnh viễn**';
            message.reply(`🚫 Đã cấm **${targetMember.user.tag}** nhắn tin tại kênh này ${timeDisplay}!\n📝 **Lý do:** ${reason}`);

            if (durationMs) {
                setTimeout(async () => {
                    try {
                        await message.channel.permissionOverwrites.edit(targetMember, { SendMessages: null });
                        message.channel.send(`📢 **${targetMember.user.tag}** đã hết thời gian cấm chat!`);
                    } catch (err) {}
                }, durationMs);
            }
        } catch (error) {
            return message.reply('❌ Không thể cấm chat! Kiểm tra lại quyền của Bot.');
        }
    }

    // 6. Lệnh .uncamchat <tag user>
    if (command === 'uncamchat') {
        if (!hasRole) return message.reply('🚫 Bạn không có quyền dùng lệnh này!');
        const targetMember = message.mentions.members.first();
        if (!targetMember) return message.reply('Vui lòng tag người dùng cần gỡ cấm chat!');

        try {
            await message.channel.permissionOverwrites.edit(targetMember, { SendMessages: null });
            return message.reply(`✅ Đã gỡ cấm nhắn tin cho **${targetMember.user.tag}**!`);
        } catch (error) {
            return message.reply('❌ Không thể gỡ cấm chat!');
        }
    }

    // 7. Lệnh .menu
    if (command === 'menu') {
        if (!hasRole) return message.reply('🚫 Bạn không có quyền mở Menu này!');

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

        return message.channel.send({ embeds: [embed], components: [row] });
    }

    // 8. Lệnh .join & .leave
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
        } catch (err) {
            return message.reply('❌ Không thể vào kênh voice!');
        }
    }

    if (command === 'leave') {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) return message.reply('❌ Bot không ở trong kênh voice!');
        connection.destroy();
        return message.reply('👋 Đã rời kênh voice!');
    }
});

// Xử lý Menu Dropdown Script Hub
client.on('interactionCreate', async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'shop_menu') {
        const selectedValue = interaction.values[0];
        const scripts = {
            'hop night hub': '⚡ **hop boss**:\n```lua\ngetgenv().Team = "Pirates"\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/WhiteX1208/Scripts/refs/heads/main/HopScript.luau](https://raw.githubusercontent.com/WhiteX1208/Scripts/refs/heads/main/HopScript.luau)"))()\n```',
            'banana fake': '▶️ **banana fake**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/aloaloalo322/sssdas/refs/heads/main/cc](https://raw.githubusercontent.com/aloaloalo322/sssdas/refs/heads/main/cc)"))()\n```',
            'main night hub': '🎬 **main night hub**:\n```lua\nscript_key = ""\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/WhiteX1208/Scripts/refs/heads/main/BF-Beta.lua](https://raw.githubusercontent.com/WhiteX1208/Scripts/refs/heads/main/BF-Beta.lua)"))()\n```',
            'main hoho hub': '🔥 **main hoho hub**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/acsu123/HOHO_H/main/Loading_UI](https://raw.githubusercontent.com/acsu123/HOHO_H/main/Loading_UI)"))()\n```',
            'teddy hub': '🧸 **teddy hub**:\n```lua\nrepeat task.wait() until game:IsLoaded()\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/Teddyseetink/Haidepzai/refs/heads/main/TEDDYHUB-FREEMIUM](https://raw.githubusercontent.com/Teddyseetink/Haidepzai/refs/heads/main/TEDDYHUB-FREEMIUM)"))()\n```',
            'trẩu v9': '😈 **trẩu v9**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/trungdao2k4/buffalo/refs/heads/main/traurobloxv9.lua](https://raw.githubusercontent.com/trungdao2k4/buffalo/refs/heads/main/traurobloxv9.lua)"))()\n```',
            'redz fake': '🔴 **redz fake**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/duongquangtungnam/Scripts/refs/heads/main/TungNamXRedz.lua](https://raw.githubusercontent.com/duongquangtungnam/Scripts/refs/heads/main/TungNamXRedz.lua)"))()\n```',
            'omg hub': '✨ **omg hub**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/Omgshit/Scripts/main/MainLoader.lua](https://raw.githubusercontent.com/Omgshit/Scripts/main/MainLoader.lua)"))()\n```',
            'fix lag': '🛠️ **fix lag**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/hienngo3760-maker/hienvip/refs/heads/main/fixlaghienbell.lua](https://raw.githubusercontent.com/hienngo3760-maker/hienvip/refs/heads/main/fixlaghienbell.lua)"))()\n```',
            'fly gui v3': '⚡ **fly gui v3**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/XNEOKING/FlyGuiV3/main/FlyGuiV3.lua](https://raw.githubusercontent.com/XNEOKING/FlyGuiV3/main/FlyGuiV3.lua)"))()\n```',
            'steal a Brainrot': '🧠 **steal a Brainrot**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/script-host/steal-a-brainrot/main/script.lua](https://raw.githubusercontent.com/script-host/steal-a-brainrot/main/script.lua)"))()\n```',
            'Grow a Garden 2': '🌱 **Grow a Garden 2**:\n```lua\nloadstring(game:HttpGet("[https://raw.githubusercontent.com/script-host/grow-a-garden-2/main/loader.lua](https://raw.githubusercontent.com/script-host/grow-a-garden-2/main/loader.lua)"))()\n```',
            'Forge Hub': '🛠️ **Forge Hub**:\n```lua\nloadstring(game:HttpGet("[https://rawscripts.net/raw/Control-Blox-Fruits-OP-FREE-GUI-77953](https://rawscripts.net/raw/Control-Blox-Fruits-OP-FREE-GUI-77953)"))()\n```',
            'Terror hub': '💀 **Terror hub**:\n```lua\nloadstring(game:HttpGet("[https://rawscripts.net/raw/Universal-Script-Terror-hub-100012](https://rawscripts.net/raw/Universal-Script-Terror-hub-100012)"))()\n```',
            'Quantum Hub': '🌌 **Quantum Hub**:\n```lua\nloadstring(game:HttpGet("[https://rawscripts.net/raw/Universal-Script-Quantum-Hub-240770](https://rawscripts.net/raw/Universal-Script-Quantum-Hub-240770)"))()\n```'
        };

        if (scripts[selectedValue]) {
            return interaction.reply({ content: scripts[selectedValue], ephemeral: true });
        }
    }
});

http.createServer((req, res) => {
    if (req.url === '/health') return res.end('OK');
    res.end('BOT ONLINE');
}).listen(process.env.PORT || 10000);

client.login(process.env.DISCORD_TOKEN);
