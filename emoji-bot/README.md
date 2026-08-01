# Emoji Counter Discord Bot

Counts emojis (both unicode 😀 and custom Discord `:emoji:`) sent in each channel, persists the counts, and can post a running total every 5 minutes to a chosen channel.

## Commands
- `!emojicount` — replies with the total emoji count for the current channel
- `!emojicount reset` — resets the count for the current channel to 0

## 1. Create the Discord bot
1. Go to https://discord.com/developers/applications → New Application
2. Go to the "Bot" tab → enable **Message Content Intent** (under Privileged Gateway Intents)
3. Copy the bot token (Bot tab → Reset Token / Copy)
4. Go to OAuth2 → URL Generator → check `bot` scope + `Send Messages`, `Read Messages/View Channels` permissions → use the generated URL to invite it to your server

## 2. Test locally (optional but recommended first)
```bash
npm install
cp .env.example .env
# paste your bot token into .env
npm start
```
Send a message with an emoji in your server, then type `!emojicount` to check it worked.

## 3. Deploy for free 24/7
### Option A: Render
1. Push this folder to a GitHub repo
2. On render.com → New → Web Service → connect the repo
3. Build command: `npm install`  |  Start command: `npm start`
4. Add environment variable `DISCORD_TOKEN` (and optionally `SUMMARY_CHANNEL_ID`) in Render's dashboard
5. Deploy
6. **Important:** Render's free tier sleeps after 15 min of no web traffic. Go to uptimerobot.com → Add New Monitor → paste your Render URL → set to ping every 5 minutes. This keeps it awake.

### Option B: Kuberns (no sleep on free tier, so no UptimeRobot needed)
1. Push this folder to a GitHub repo
2. Connect the repo on kuberns.com, add `DISCORD_TOKEN` as an environment variable, deploy

## Notes
- `emojiCounts.json` is where counts are saved. On most free hosts this resets on redeploy since it's not permanent storage — fine for a hobby bot, but let me know if you want it moved to a real database instead.
- To find a channel ID for `SUMMARY_CHANNEL_ID`: enable Developer Mode in Discord (User Settings → Advanced), then right-click a channel → Copy Channel ID.
