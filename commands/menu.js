const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require('discord.js');

const allowedRoleIds = ['1420260959913775155', '1420753551587807353', '1420262154271199283'];

function isAdmin(member) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    return member.roles.cache.some(role => allowedRoleIds.includes(role.id));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Hiển thị bảng chọn Script Hub')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        if (!isAdmin(interaction.member)) {
            return interaction.reply({ content: '🚫 Bạn không có quyền Admin để hiển thị Menu này!', ephemeral: true });
        }

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

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};
