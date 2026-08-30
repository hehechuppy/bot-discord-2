require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    EmbedBuilder,
    PermissionFlagsBits
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

// --- BỔ SUNG: QUẢN LÝ DỮ LIỆU SINH NHẬT ---
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

// Hàm hỗ trợ chuyển đổi chuỗi thời gian (ví dụ: 10p, 2h, 1d) sang miligiây
function parseTimeToMs(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.trim().match(/^(\d+)\s*([phdPHD])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'p': return value * 60 * 1000;          // Phút
        case 'h': return value * 60 * 60 * 1000;     // Giờ
        case 'd': return value * 24 * 60 * 60 * 1000; // Ngày
        default: return null;
    }
}

// 1. Định nghĩa cấu trúc danh sách lệnh gạch chéo
const commands = [
    new SlashCommandBuilder()
        .setName('say')
        .setDescription('Nhại lại câu nói của bạn!')
        .addStringOption(option =>
            option.setName('noidung')
                .setDescription('Nội dung bạn muốn bot nói')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Xóa một số lượng tin nhắn trong kênh')
        .addIntegerOption(option =>
            option.setName('soluong')
                .setDescription('Số lượng tin nhắn muốn xóa (từ 1 đến 100)')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('mute')
        .setDescription('mute troll')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('Người bạn muốn mute')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('time')
                .setDescription('Thời gian mute (tính bằng phút)')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('Lý do mute')),
    new SlashCommandBuilder()
        .setName('camchat')
        .setDescription('Cấm người dùng nhắn tin trong 1 kênh cụ thể')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Người muốn cấm chat')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('thoigian')
                .setDescription('Thời gian cấm (VD: 10p, 2h, 1d). Bỏ trống = cấm vĩnh viễn'))
        .addChannelOption(option =>
            option.setName('kenh')
                .setDescription('Kênh muốn cấm (để trống nếu muốn cấm ở kênh hiện tại)'))
        .addStringOption(option =>
            option.setName('lydo')
                .setDescription('Lý do cấm chat')),
    new SlashCommandBuilder()
        .setName('uncamchat')
        .setDescription('Hủy cấm chat người dùng trong 1 kênh cụ thể')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Người muốn gỡ cấm chat')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('kenh')
                .setDescription('Kênh muốn gỡ cấm (để trống nếu là kênh hiện tại)')),
    new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Hiển thị bảng chọn Script Hub'),
    new SlashCommandBuilder()
        .setName('join')
        .setDescription('Cho bot vào kênh voice bạn đang ở và ở lại đó'),
    new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Cho bot rời khỏi kênh voice hiện tại'),
    
    // --- BỔ SUNG: LỆNH BIRTHDAY ---
    new SlashCommandBuilder()
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
                .setDescription('Xóa thông tin sinh nhật của bạn'))
].map(command => command.toJSON());

// --- BỔ SUNG: LÊN LỊCH CHECK SINH NHẬT MỖI NGÀY ---
function scheduleBirthdayCheck() {
    const checkBirthdays = async () => {
        const birthdays = loadBirthdays();
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;

        for (const [userId, info] of Object.entries(birthdays)) {
            if (info.day === day && info.month === month) {
                // Gửi tin nhắn chúc mừng tới từng Guild có thành viên đó
                client.guilds.cache.forEach(async (guild) => {
                    try {
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            // Tìm kênh văn bản đầu tiên có quyền gửi tin nhắn
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

    // Kiểm tra ngay khi khởi chạy và mỗi 24 giờ
    checkBirthdays();
    setInterval(checkBirthdays, 24 * 60 * 60 * 1000);
}

client.once('ready', async () => {
    console.log(`Bot đã đăng nhập thành công dưới tên: ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Đang đăng ký lệnh gạch chéo (/)...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Đăng ký lệnh thành công!');
    } catch (error) {
        console.error(error);
    }

    // Bắt đầu vòng lặp kiểm tra sinh nhật
    scheduleBirthdayCheck();
});

// 2. Sự kiện xử lý tin nhắn
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const contentLower = message.content.toLowerCase();

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
        const args = message.content.split(' ').slice(1);
        const reason = args.join(' ') || 'Không có lý do';

        const member = message.member;
        const oldName = member ? member.displayName : message.author.username;

        afkMap.set(userId, {
            reason: reason,
            oldName: oldName,
            time: Date.now()
        });

        if (member) {
            const newNickname = `[AFK] ${oldName}`.substring(0, 32);
            await member.setNickname(newNickname).catch(() => {});
        }

        return message.reply(`💤 **${message.author.username}** đã bật AFK!\n📝 Lý do: **${reason}**`);
    }

    if (contentLower === 'ping') {
        message.reply('Pong! 🏓');
    }
    if (contentLower === 'xin chào') {
        message.channel.send(`Chào ${message.author.username}! Mình có thể giúp gì cho bạn?`);
    }
    if (contentLower === 'cảm ơn') {
        message.channel.send(`Không có gì đâu ${message.author.username}!`);
    }
    if (contentLower === 'ê') {
        message.reply('ê cái gì mà ê');
    }
});

// 3. Sự kiện xử lý tương tác
client.on('interactionCreate', async interaction => {
    
    if (interaction.isStringSelectMenu() && interaction.customId === 'shop_menu') {
        const selectedValue = interaction.values[0];

        if (selectedValue === 'hop night hub') {
            return interaction.reply({ 
                content: `⚡ **hop boss**:\n\`\`\`lua\ngetgenv().Team = "Pirates"\nloadstring(game:HttpGet("https://raw.githubusercontent.com/WhiteX1208/Scripts/refs/heads/main/HopScript.luau"))()\n\`\`\``, 
                ephemeral: true 
            });
        } else if (selectedValue === 'banana fake') {
            return interaction.reply({ 
                content: `▶️ **banana fake**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/aloaloalo322/sssdas/refs/heads/main/cc"))()\n\`\`\``, 
                ephemeral: true 
            });
        } else if (selectedValue === 'main night hub') {
            return interaction.reply({ 
                content: `🎬 **main night hub**:\n\`\`\`lua\nscript_key = ""\nloadstring(game:HttpGet("https://raw.githubusercontent.com/WhiteX1208/Scripts/refs/heads/main/BF-Beta.lua"))()\n\`\`\``, 
                ephemeral: true 
            });
        } else if (selectedValue === 'main hoho hub') {
            return interaction.reply({
                content: `🔥 **main hoho hub**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/acsu123/HOHO_H/main/Loading_UI"))()\n\`\`\``,
                ephemeral: true 
            });
        } else if (selectedValue === 'teddy hub') {
            return interaction.reply({
                content: `🧸 **teddy hub**:\n\`\`\`lua\nrepeat task.wait() until game:IsLoaded()\nloadstring(game:HttpGet("https://raw.githubusercontent.com/Teddyseetink/Haidepzai/refs/heads/main/TEDDYHUB-FREEMIUM"))()\n\`\`\``,
                ephemeral: true 
            });
        } else if (selectedValue === 'trẩu v9') {
            return interaction.reply({
                content: `😈 **trẩu v9**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/trungdao2k4/buffalo/refs/heads/main/traurobloxv9.lua"))()\n\`\`\``,
                ephemeral: true
            });
        } else if (selectedValue === 'redz fake') {
            return interaction.reply({
                content: `🔴 **redz fake**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/duongquangtungnam/Scripts/refs/heads/main/TungNamXRedz.lua"))()\n\`\`\``,
                ephemeral: true
            });
        } else if (selectedValue === 'omg hub') {
            return interaction.reply({
                content: `✨ **omg hub**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/Omgshit/Scripts/main/MainLoader.lua"))()\n\`\`\``, 
                ephemeral: true 
            });
        } else if (selectedValue === 'fix lag') {
            return interaction.reply({
                content: `🛠️ **fix lag**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/hienngo3760-maker/hienvip/refs/heads/main/fixlaghienbell.lua"))()\n\`\`\``,
                ephemeral: true
            });
        } else if (selectedValue === 'fly gui v3') {
             return interaction.reply({
                content: `⚡ **fly gui v3**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/XNEOKING/FlyGuiV3/main/FlyGuiV3.lua"))()\n\`\`\``,
                ephemeral: true
             });
        } else if (selectedValue === 'steal a Brainrot') {
            return interaction.reply({
                content: `🧠 **steal a Brainrot**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/script-host/steal-a-brainrot/main/script.lua"))()\n\`\`\``,
                ephemeral: true
            });
        } else if (selectedValue === 'Grow a Garden 2') {
            return interaction.reply({
                content: `🌱 **Grow a Garden 2**:\n\`\`\`lua\nloadstring(game:HttpGet("https://raw.githubusercontent.com/script-host/grow-a-garden-2/main/loader.lua"))()\n\`\`\``,
                ephemeral: true 
            });
        } else if (selectedValue === 'Forge Hub') {
            return interaction.reply({
                content: `🛠️ **Forge Hub**:\n\`\`\`lua\nloadstring(game:HttpGet("https://rawscripts.net/raw/Control-Blox-Fruits-OP-FREE-GUI-77953"))()\n\`\`\``,
                ephemeral: true
            });
        } else if (selectedValue === 'Terror hub') {
            return interaction.reply({
                content: `💀 **Terror hub**:\n\`\`\`lua\nloadstring(game:HttpGet("https://rawscripts.net/raw/Universal-Script-Terror-hub-100012"))()\n\`\`\``,
                ephemeral: true
            });
        } else if (selectedValue === 'Quantum Hub') {
            return interaction.reply({
                content: `🌌 **Quantum Hub**:\n\`\`\`lua\nloadstring(game:HttpGet("https://rawscripts.net/raw/Universal-Script-Quantum-Hub-240770"))()\n\`\`\``,
                ephemeral: true
            });
        }
    } 

    if (!interaction.isChatInputCommand()) return;

    // Danh sách Role ID được phép dùng lệnh
    const allowedRoleIds = [
        '1420260959913775155', 
        '1420753551587807353', 
        '1420262154271199283'
    ];

    const hasRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));

    // --- BỔ SUNG: XỬ LÝ LỆNH BIRTHDAY ---
    if (interaction.commandName === 'birthday') {
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

    if (interaction.commandName === 'say') {
        const noiDung = interaction.options.getString('noidung');
        await interaction.reply({ content: `Bạn vừa bắt bot nói: **${noiDung}**` });
    }

    if (interaction.commandName === 'clear') {
        if (!hasRole) {
            return interaction.reply({ content: '🚫 Bạn không có Role được phép sử dụng lệnh này!', ephemeral: true });
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

    if (interaction.commandName === 'mute') {
        if (!hasRole) {
            return interaction.reply({ content: '🚫 Bạn không có Role được phép sử dụng lệnh này!', ephemeral: true });
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
            await interaction.reply({ content: 'Không thể mute người này do thiếu quyền!', ephemeral: true });
        }
    }

    if (interaction.commandName === 'camchat') {
        if (!hasRole) {
            return interaction.reply({ content: '🚫 Bạn không có Role được phép sử dụng lệnh này!', ephemeral: true });
        }

        const targetMember = interaction.options.getMember('target');
        const timeInput = interaction.options.getString('thoigian');
        const targetChannel = interaction.options.getChannel('kenh') || interaction.channel;
        const reason = interaction.options.getString('lydo') || 'Không có lý do';

        if (!targetMember) {
            return interaction.reply({ content: '❌ Không tìm thấy người dùng này trong Server!', ephemeral: true });
        }

        let durationMs = null;
        if (timeInput) {
            durationMs = parseTimeToMs(timeInput);
            if (!durationMs) {
                return interaction.reply({ 
                    content: '❌ Định dạng thời gian không hợp lệ! Vui lòng dùng: **p** (phút), **h** (giờ), **d** (ngày). VD: `10p`, `2h`, `1d`.', 
                    ephemeral: true 
                });
            }
        }

        try {
            await targetChannel.permissionOverwrites.edit(targetMember, {
                SendMessages: false
            }, { reason });

            const timeDisplay = timeInput ? `trong **${timeInput}**` : '**vĩnh viễn**';
            await interaction.reply({
                content: `🚫 Đã cấm **${targetMember.user.tag}** nhắn tin tại kênh ${targetChannel} ${timeDisplay}!\n📝 **Lý do:** ${reason}`
            });

            if (durationMs) {
                setTimeout(async () => {
                    try {
                        await targetChannel.permissionOverwrites.edit(targetMember, {
                            SendMessages: null
                        });
                        await targetChannel.send(`📢 **${targetMember.user.tag}** đã hết thời gian cấm chat và có thể nhắn tin lại!`);
                    } catch (err) {
                        console.error('Lỗi khi tự động gỡ cấm chat:', err);
                    }
                }, durationMs);
            }

        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: '❌ Không thể cấm chat! Kiểm tra lại quyền của Bot (Bot cần quyền *Manage Channels*).',
                ephemeral: true
            });
        }
    }

    if (interaction.commandName === 'uncamchat') {
        if (!hasRole) {
            return interaction.reply({ content: '🚫 Bạn không có Role được phép sử dụng lệnh này!', ephemeral: true });
        }

        const targetMember = interaction.options.getMember('target');
        const targetChannel = interaction.options.getChannel('kenh') || interaction.channel;

        if (!targetMember) {
            return interaction.reply({ content: '❌ Không tìm thấy người dùng này trong Server!', ephemeral: true });
        }

        try {
            await targetChannel.permissionOverwrites.edit(targetMember, {
                SendMessages: null
            });

            return interaction.reply({
                content: `✅ Đã gỡ cấm nhắn tin cho **${targetMember.user.tag}** tại kênh ${targetChannel}!`
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({
                content: '❌ Không thể gỡ cấm chat! Kiểm tra lại quyền của Bot.',
                ephemeral: true
            });
        }
    }

    if (interaction.commandName === 'menu') {
        if (!hasRole) {
            return interaction.reply({ content: '🚫 Bạn không có Role được phép hiển thị Menu này!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#7289DA')
            .setTitle('🔥 DANH SÁCH SCRIPT HUB')
            .setDescription('Nhấn vào menu bên dưới để lấy thông tin Script bạn cần nhé!');

        const row = new ActionRowBuilder()
            .addComponents(
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

        await interaction.reply({ embeds: [embed], components: [row] });
    }

    if (interaction.commandName === 'join') {
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

    if (interaction.commandName === 'leave') {
        const connection = getVoiceConnection(interaction.guildId);
        if (!connection) {
            return interaction.reply({ content: '❌ Bot hiện không ở trong kênh voice nào!', ephemeral: true });
        }
        connection.destroy();
        return interaction.reply({ content: '👋 Đã rời khỏi kênh voice!' });
    }
});

http.createServer((req, res) => {
    if (req.url === '/health') return res.end('OK');
    res.end('BOT ONLINE');
}).listen(process.env.PORT || 10000);

client.login(process.env.DISCORD_TOKEN);
