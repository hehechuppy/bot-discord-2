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
const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const playdl = require('play-dl');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers, // Bắt buộc bật để bot thay đổi được nickname
        GatewayIntentBits.GuildVoiceStates, // Bắt buộc bật để bot vào/xử lý kênh voice
    ],
});

// Map lưu trữ thông tin AFK: { reason, oldName }
const afkMap = new Map();

// ================= HỆ THỐNG PHÁT NHẠC =================
// guildId -> { player, queue: [{url,title,requestedBy}], textChannel, nowPlaying }
const musicStates = new Map();

function getMusicState(guildId) {
    let state = musicStates.get(guildId);
    if (!state) {
        const player = createAudioPlayer();
        state = { player, queue: [], textChannel: null, nowPlaying: null };

        player.on(AudioPlayerStatus.Idle, () => {
            state.nowPlaying = null;
            playNextInQueue(guildId);
        });

        player.on('error', (err) => {
            console.error('❌ Lỗi audio player:', err);
            if (state.textChannel) state.textChannel.send('❌ Có lỗi khi phát nhạc, đang chuyển bài tiếp theo...').catch(() => {});
            state.nowPlaying = null;
            playNextInQueue(guildId);
        });

        musicStates.set(guildId, state);
    }
    return state;
}

async function resolveTrack(query) {
    const type = playdl.yt_validate(query);
    if (type === 'video') {
        const info = await playdl.video_basic_info(query);
        return { url: query, title: info.video_details.title };
    }
    const results = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
    if (!results || results.length === 0) return null;
    return { url: results[0].url, title: results[0].title };
}

async function playNextInQueue(guildId) {
    const state = musicStates.get(guildId);
    if (!state || state.queue.length === 0) return;

    const track = state.queue.shift();
    try {
        const streamInfo = await playdl.stream(track.url);
        const resource = createAudioResource(streamInfo.stream, { inputType: streamInfo.type });
        state.player.play(resource);
        state.nowPlaying = track;
        if (state.textChannel) {
            state.textChannel.send(`🎶 Đang phát: **${track.title}**`).catch(() => {});
        }
    } catch (e) {
        console.error('❌ Lỗi khi lấy stream:', e);
        if (state.textChannel) state.textChannel.send(`❌ Không thể phát **${track.title}**, bỏ qua bài này.`).catch(() => {});
        playNextInQueue(guildId);
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
        .setName('menu')
        .setDescription('Hiển thị bảng chọn Script Hub'),
    new SlashCommandBuilder()
        .setName('join')
        .setDescription('Cho bot vào kênh voice bạn đang ở và ở lại đó'),
    new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Cho bot rời khỏi kênh voice hiện tại'),
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc từ YouTube (dán link hoặc gõ tên bài để tìm kiếm)')
        .addStringOption(option =>
            option.setName('noidung')
                .setDescription('Link YouTube hoặc tên bài hát')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài đang phát'),
    new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Dừng phát nhạc, xóa hàng chờ và rời kênh voice'),
    new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Xem danh sách hàng chờ nhạc')
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

    // --- LỆNH /join: bot vào kênh voice của người gọi lệnh và ở lại đó ---
    if (interaction.commandName === 'join') {
        const memberVoiceChannel = interaction.member.voice.channel;
        if (!memberVoiceChannel) {
            return interaction.reply({ content: '❌ Bạn cần đang ở trong 1 kênh voice để dùng lệnh này!', ephemeral: true });
        }

        try {
            const connection = joinVoiceChannel({
                channelId: memberVoiceChannel.id,
                guildId: memberVoiceChannel.guild.id,
                adapterCreator: memberVoiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false
            });
            const state = getMusicState(interaction.guildId);
            connection.subscribe(state.player);
            return interaction.reply({ content: `✅ Đã vào kênh voice **${memberVoiceChannel.name}**!` });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: '❌ Không thể vào kênh voice, kiểm tra lại quyền của bot!', ephemeral: true });
        }
    }

    // --- LỆNH /leave: bot rời khỏi kênh voice hiện tại ---
    if (interaction.commandName === 'leave') {
        const connection = getVoiceConnection(interaction.guildId);
        if (!connection) {
            return interaction.reply({ content: '❌ Bot hiện không ở trong kênh voice nào!', ephemeral: true });
        }
        const state = musicStates.get(interaction.guildId);
        if (state) {
            state.queue = [];
            state.nowPlaying = null;
            state.player.stop();
        }
        connection.destroy();
        return interaction.reply({ content: '👋 Đã rời khỏi kênh voice!' });
    }

    // --- LỆNH /play: phát nhạc từ YouTube (link hoặc tìm kiếm) ---
    if (interaction.commandName === 'play') {
        const memberVoiceChannel = interaction.member.voice.channel;
        if (!memberVoiceChannel) {
            return interaction.reply({ content: '❌ Bạn cần đang ở trong 1 kênh voice để dùng lệnh này!', ephemeral: true });
        }

        await interaction.deferReply();

        const query = interaction.options.getString('noidung');
        let track;
        try {
            track = await resolveTrack(query);
        } catch (e) {
            console.error(e);
            return interaction.editReply('❌ Có lỗi khi tìm bài hát, thử lại sau.');
        }
        if (!track) {
            return interaction.editReply('❌ Không tìm thấy bài hát nào khớp với yêu cầu của bạn!');
        }
        track.requestedBy = interaction.user.username;

        const state = getMusicState(interaction.guildId);
        state.textChannel = interaction.channel;

        let connection = getVoiceConnection(interaction.guildId);
        if (!connection) {
            connection = joinVoiceChannel({
                channelId: memberVoiceChannel.id,
                guildId: interaction.guildId,
                adapterCreator: memberVoiceChannel.guild.voiceAdapterCreator,
                selfDeaf: false
            });
        }
        connection.subscribe(state.player);

        state.queue.push(track);

        if (!state.nowPlaying && state.player.state.status === AudioPlayerStatus.Idle) {
            playNextInQueue(interaction.guildId);
            return interaction.editReply(`🎶 Đang phát ngay: **${track.title}**`);
        } else {
            return interaction.editReply(`✅ Đã thêm vào hàng chờ: **${track.title}** (vị trí #${state.queue.length})`);
        }
    }

    // --- LỆNH /skip: bỏ qua bài đang phát ---
    if (interaction.commandName === 'skip') {
        const state = musicStates.get(interaction.guildId);
        if (!state || !state.nowPlaying) {
            return interaction.reply({ content: '❌ Hiện không có bài nào đang phát!', ephemeral: true });
        }
        state.player.stop(); // sẽ tự kích hoạt AudioPlayerStatus.Idle -> phát bài tiếp theo
        return interaction.reply('⏭️ Đã bỏ qua bài hát.');
    }

    // --- LỆNH /stop: dừng phát nhạc, xóa hàng chờ, rời voice ---
    if (interaction.commandName === 'stop') {
        const state = musicStates.get(interaction.guildId);
        if (state) {
            state.queue = [];
            state.nowPlaying = null;
            state.player.stop();
        }
        const connection = getVoiceConnection(interaction.guildId);
        if (connection) connection.destroy();
        return interaction.reply('⏹️ Đã dừng phát nhạc và rời kênh voice.');
    }

    // --- LỆNH /queue: xem hàng chờ nhạc ---
    if (interaction.commandName === 'queue') {
        const state = musicStates.get(interaction.guildId);
        if (!state || (!state.nowPlaying && state.queue.length === 0)) {
            return interaction.reply({ content: '📭 Hàng chờ nhạc đang trống!', ephemeral: true });
        }
        let desc = '';
        if (state.nowPlaying) desc += `▶️ **Đang phát:** ${state.nowPlaying.title}\n\n`;
        if (state.queue.length > 0) {
            desc += state.queue.map((t, i) => `${i + 1}. ${t.title}`).join('\n');
        } else {
            desc += '_Hàng chờ trống._';
        }
        const embed = new EmbedBuilder().setColor('#7289DA').setTitle('🎵 HÀNG CHỜ NHẠC').setDescription(desc);
        return interaction.reply({ embeds: [embed] });
    }
});

http.createServer((req, res) => {
    if (req.url === '/health') return res.end('OK');
    res.end('BOT ONLINE');
}).listen(process.env.PORT || 10000);

client.login(process.env.DISCORD_TOKEN);
