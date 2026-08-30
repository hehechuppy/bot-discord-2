require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

client.commands = new Collection();

// Tải tất cả Lệnh trong thư mục /commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if (Array.isArray(command)) {
        command.forEach(cmd => client.commands.set(cmd.data.name, cmd));
    } else if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// Tải tất cả Sự kiện trong thư mục /events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Khởi tạo Server HTTP Keep-alive
http.createServer((req, res) => {
    if (req.url === '/health') return res.end('OK');
    res.end('BOT ONLINE');
}).listen(process.env.PORT || 10000);

client.login(process.env.DISCORD_TOKEN);
