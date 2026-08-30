const scriptHubs = {
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

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (interaction.isStringSelectMenu() && interaction.customId === 'shop_menu') {
            const selectedValue = interaction.values[0];
            if (scriptHubs[selectedValue]) {
                return interaction.reply({ content: scriptHubs[selectedValue], ephemeral: true });
            }
        }

        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Có lỗi xảy ra khi thực thi lệnh!', ephemeral: true });
        }
    }
};
