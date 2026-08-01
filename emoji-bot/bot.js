const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const express = require('express');
require('dotenv').config();

// ---------- CONFIG ----------
const DATA_FILE = './emojiCounts.json';
const SUMMARY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SUMMARY_CHANNEL_ID = process.env.SUMMARY_CHANNEL_ID || null; // optional: channel to auto-post summary in

// ---------- EMOJI DETECTION ----------
// Custom Discord emojis: <:name:id> or <a:name:id>
const customEmojiRegex = /<a?:\w+:\d+>/g;
// Unicode emojis (covers most emoji ranges)
const unicodeEmojiRegex = /\p{Extended_Pictographic}/gu;

function countEmojis(text) {
  const custom = (text.match(customEmojiRegex) || []).length;
  const unicode = (text.match(unicodeEmojiRegex) || []).length;
  return custom + unicode;
}

// ---------- PERSISTENCE ----------
function loadCounts() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {}; // { channelId: totalCount }
  }
}

function saveCounts(counts) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(counts, null, 2));
}

let emojiCounts = loadCounts();

// ---------- DISCORD CLIENT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Optional: post a summary to a fixed channel every 5 minutes
  if (SUMMARY_CHANNEL_ID) {
    setInterval(async () => {
      try {
        const channel = await client.channels.fetch(SUMMARY_CHANNEL_ID);
        const total = emojiCounts[SUMMARY_CHANNEL_ID] || 0;
        channel.send(`📊 Emoji count update: **${total}** emojis counted in this channel so far.`);
      } catch (err) {
        console.error('Failed to post summary:', err.message);
      }
    }, SUMMARY_INTERVAL_MS);
  }
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  // Command: !emojicount
  if (message.content === '!emojicount') {
    const count = emojiCounts[message.channelId] || 0;
    message.reply(`Total emojis counted in this channel: **${count}**`);
    return;
  }

  // Command: !emojicount reset  (admin-ish, no permission check added here on purpose - add if needed)
  if (message.content === '!emojicount reset') {
    emojiCounts[message.channelId] = 0;
    saveCounts(emojiCounts);
    message.reply('Emoji count reset for this channel.');
    return;
  }

  const found = countEmojis(message.content);
  if (found > 0) {
    emojiCounts[message.channelId] = (emojiCounts[message.channelId] || 0) + found;
    saveCounts(emojiCounts);
  }
});

client.login(process.env.DISCORD_TOKEN);

// ---------- KEEP-ALIVE WEB SERVER (for Render/UptimeRobot) ----------
const app = express();
app.get('/', (req, res) => res.send('Emoji bot is alive.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));
