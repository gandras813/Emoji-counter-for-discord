const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const express = require('express');
require('dotenv').config();
 
// ---------- CONFIG ----------
const DATA_FILE = './emojiCounts.json';
const USER_DATA_FILE = './userEmojiCounts.json';
const PIN_CHANNEL_ID = process.env.PIN_CHANNEL_ID || null; // channel with the live-updating pinned count
const PINNED_MSG_FILE = './pinnedMessageId.json'; // remembers which message to edit
const PINNED_LEADERBOARD_FILE = './pinnedLeaderboardId.json'; // remembers the leaderboard pinned message
 
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
 
function loadUserCounts() {
  try {
    return JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf8'));
  } catch {
    return {}; // { userId: { username, count } }
  }
}
 
function saveUserCounts(counts) {
  fs.writeFileSync(USER_DATA_FILE, JSON.stringify(counts, null, 2));
}
 
let emojiCounts = loadCounts();
let userEmojiCounts = loadUserCounts();
 
// ---------- PINNED MESSAGE TRACKING ----------
function loadPinnedId(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')).messageId;
  } catch {
    return null;
  }
}
 
function savePinnedId(file, id) {
  fs.writeFileSync(file, JSON.stringify({ messageId: id }));
}
 
async function updatePinnedMessage(channel, file, text) {
  let messageId = loadPinnedId(file);
 
  // Try editing the existing pinned message
  if (messageId) {
    try {
      const msg = await channel.messages.fetch(messageId);
      await msg.edit(text);
      return;
    } catch {
      // message was deleted or not found - fall through to create a new one
    }
  }
 
  // No existing message - create and pin a new one
  const newMsg = await channel.send(text);
  await newMsg.pin();
  savePinnedId(file, newMsg.id);
}
 
function buildCountText() {
  const count = emojiCounts[PIN_CHANNEL_ID] || 0;
  return `🍞 Emojis counted in this channel: **${count}**`;
}
 
function buildLeaderboardText() {
  const entries = Object.values(userEmojiCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
 
  if (entries.length === 0) {
    return '**Emoji Leaderboard** 🍞\nNo emojis counted yet!';
  }
 
  const medals = ['🥇', '🥈', '🥉'];
  const lines = entries.map((entry, i) => {
    const rank = medals[i] || `${i + 1}.`;
    return `${rank} ${entry.username} — **${entry.count}**`;
  });
 
  return `**Emoji Leaderboard** 🍞\n${lines.join('\n')}`;
}
 
async function refreshPins(channel) {
  await updatePinnedMessage(channel, PINNED_MSG_FILE, buildCountText());
  await updatePinnedMessage(channel, PINNED_LEADERBOARD_FILE, buildLeaderboardText());
}
 
// ---------- DISCORD CLIENT ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
 
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
 
  if (PIN_CHANNEL_ID) {
    try {
      const channel = await client.channels.fetch(PIN_CHANNEL_ID);
      await refreshPins(channel); // make sure both pinned messages exist on startup
    } catch (err) {
      console.error('Failed to set up pinned count message:', err.message);
    }
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
 
  // Command: !myemojicount - shows the sender's personal total
  if (message.content === '!myemojicount') {
    const userData = userEmojiCounts[message.author.id];
    const count = userData ? userData.count : 0;
    message.reply(`You've sent **${count}** emojis in total. 🍞`);
    return;
  }
 
  // Command: !emojileaderboard - shows top senders across all channels
  if (message.content === '!emojileaderboard') {
    message.reply(buildLeaderboardText());
    return;
  }
 
  const found = countEmojis(message.content);
  if (found > 0) {
    emojiCounts[message.channelId] = (emojiCounts[message.channelId] || 0) + found;
    saveCounts(emojiCounts);
 
    // Track per-user counts too
    const userId = message.author.id;
    if (!userEmojiCounts[userId]) {
      userEmojiCounts[userId] = { username: message.author.username, count: 0 };
    }
    userEmojiCounts[userId].username = message.author.username; // keep name fresh in case it changed
    userEmojiCounts[userId].count += found;
    saveUserCounts(userEmojiCounts);
 
    // If this message is in the pinned-count channel, refresh both pinned messages
    if (PIN_CHANNEL_ID && message.channelId === PIN_CHANNEL_ID) {
      refreshPins(message.channel).catch((err) =>
        console.error('Failed to update pinned messages:', err.message)
      );
    }
  }
});
 
client.login(process.env.DISCORD_TOKEN);
 
// ---------- KEEP-ALIVE WEB SERVER (for Render/UptimeRobot) ----------
const app = express();
app.get('/', (req, res) => res.send('Emoji bot is alive.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));
