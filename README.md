# ⚡ CiganyHUB Stateless 8-Hour Key System (Vercel)

A 100% free, zero-database key system with anti-bot protection and 8-hour auto-expiring keys.

---

## 🚀 Free Vercel Deployment (2-Minute Setup)

### Option A: Using Vercel Web Dashboard (Easiest)
1. Go to **[vercel.com](https://vercel.com/)** and sign up / log in with GitHub (Free).
2. Create a new GitHub repository and push this `key_system_site` folder to it.
3. On Vercel, click **"Add New..."** > **"Project"** and select your repository.
4. (Optional) Under **Environment Variables**, add:
   - `KEY_SECRET` = (Any long random password of your choice)
5. Click **"Deploy"**.
6. You will get a free live URL: `https://your-project.vercel.app`!

---

### Option B: Using Vercel CLI
Run in terminal:
```bash
cd key_system_site
npx vercel
```
Follow the prompts to deploy instantly.

---

## 📁 File Breakdown

- **`public/index.html`**: The modern dark glassmorphism website showing live 8-hour countdown, generation button, copy key button, Discord button, and key status checker.
- **`api/generate.js`**: Serverless function that generates cryptographically signed HMAC-SHA256 tokens valid for 8 hours.
- **`api/verify.js`**: Serverless function that checks if the key is valid and calculates the exact remaining minutes/hours.
- **`api/get-script.js`**: Serverless endpoint that serves the loader code only when a valid key is provided (blocks Discord bot scrapers).
- **`KeyGUI.lua`**: The in-game Lua GUI for Roblox executors that lets players verify their key, click "Get Key" (copies URL to clipboard), and click "Discord". It also automatically saves the valid key to a local file so the player doesn't have to re-enter it for 8 hours.

---

## ⚙️ How to Connect to Your Script

1. Open [`key_system_site/KeyGUI.lua`](file:///c:/Users/TUF/Downloads/roblox-executor-mcp-main/roblox-executor-mcp-main/key_system_site/KeyGUI.lua).
2. Update line 8:
   ```lua
   local VERCEL_DOMAIN = "https://your-project-name.vercel.app"
   local DISCORD_INVITE = "https://discord.gg/yourserver"
   ```
3. Run `KeyGUI.lua` in your executor!
