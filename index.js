require('dotenv').config();
const http = require('http');
const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    EmbedBuilder 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // Bắt buộc bật để bot thay đổi được nickname
    ],
});

// Map lưu trữ thông tin AFK: { reason, oldName }
const afkMap = new Map();

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
        .setName('menu')
        .setDescription('Hiển thị bảng chọn Script Hub')
].map(command => command.toJSON());

// Sửa lại thành 'ready' thay vì 'clientReady'
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
});

// 2. Sự kiện xử lý tin nhắn
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
    const contentLower = message.content.toLowerCase();

    // --- A. TỰ ĐỘNG BỎ AFK VÀ KHÔI PHỤC TÊN KHI CHAT LẠI ---
    if (afkMap.has(userId)) {
        const afkData = afkMap.get(userId);
        afkMap.delete(userId);

        // Khôi phục lại tên ban đầu của người dùng trên server
        if (message.member) {
            await message.member.setNickname(afkData.oldName).catch(() => {});
        }

        const replyMsg = await message.reply(`🎉 Chào mừng trở lại, **${message.author.username}**! Đã gỡ trạng thái AFK.`);
        setTimeout(() => replyMsg.delete().catch(() => {}), 5000); 
    }

    // --- B. BÁO LỖI KHI AI ĐÓ TAG NGƯỜI ĐANG AFK ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            if (afkMap.has(user.id)) {
                const afkData = afkMap.get(user.id);
                message.reply(`💤 **${user.username}** hiện đang AFK!\n📝 Lý do: *${afkData.reason}*`);
            }
        });
    }

    // --- C. XỬ LÝ LỆNH AFK (.afk hoặc ?afk) ---
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

    // --- D. TỪ KHÓA CHAT THƯỜNG ---
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

    const allowedRoleIds = [
        '1420260959913775155', 
        '1420753551587807353', 
        '1420262154271199283'
    ];

    const hasRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));
    const isAdmin = interaction.member.permissions.has('Administrator');

    if (interaction.commandName === 'say') {
        const noiDung = interaction.options.getString('noidung');
        await interaction.reply({ content: `Bạn vừa bắt bot nói: **${noiDung}**` });
    }

    if (interaction.commandName === 'clear') {
        if (!hasRole && !isAdmin) {
            return interaction.reply({ content: '🚫 Bạn không có quyền sử dụng lệnh này!', ephemeral: true });
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
        if (!hasRole && !isAdmin) {
            return interaction.reply({ content: '🚫 Bạn không có quyền sử dụng lệnh này!', ephemeral: true });
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

    if (interaction.commandName === 'menu') {
        if (!hasRole && !isAdmin) {
            return interaction.reply({ content: '🚫 Bạn không có quyền hiển thị Menu này!', ephemeral: true });
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
});

http.createServer((req, res) => {
    if (req.url === '/health') return res.end('OK');
    res.end('BOT ONLINE');
}).listen(process.env.PORT || 10000);

client.login(process.env.DISCORD_TOKEN);
