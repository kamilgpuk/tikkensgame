# Tomorrow's Plan — Getting AI Hype Machine Live

Work through this top to bottom. Each section tells you what you're doing and why.
Estimated total time: **1–2 hours** (mostly waiting for installs).

---

## Before you start

You need:
- [ ] The MacBook, plugged in
- [ ] A coffee
- [ ] Your phone nearby (some steps open browser links)

---

## Part 1 — Run the game locally (30–45 min)

This gets the game running on your laptop. No internet access yet, just making sure it works.

### 1.1 Open Terminal
- Press `Cmd + Space`, type `Terminal`, press Enter

### 1.2 Paste the bootstrap command
Copy this entire line and paste it into Terminal, press Enter:
```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/kamilgpuk/tikkensgame/main/bootstrap.sh)"
```

### 1.3 Follow the prompts
The script will:
- Ask you to click **Install** in a popup (Xcode tools) — click it, wait ~5 min
- Install Homebrew — it may ask for your **Mac password**, type it (you won't see characters, that's normal)
- Install Node.js and cloudflared automatically
- Clone the game code into `~/ai-hype-machine`

### 1.4 Test it locally first
When it's done, open your browser and go to:
```
http://localhost:3000
```
You should see the game. Enter a name and play for a minute to make sure it works.
If it doesn't load, check Part 5 (Troubleshooting) at the bottom.

---

## Part 2 — Get a domain (15 min)

Skip this if you already have a domain you want to use.

### 2.1 Buy a domain
Go to **namecheap.com** or **cloudflare.com/products/registrar**
- Pick something short, e.g. `aihypemachine.com` or `tokenfarmer.io`
- Cost: ~$10–15/year
- Cloudflare Registrar is slightly cheaper and makes Part 3 easier

### 2.2 Write down your domain name
```
My domain: ___________________________
```

---

## Part 3 — Connect domain to Cloudflare (20 min)

This gives you a permanent public URL instead of a random one that changes.

### 3.1 Create a Cloudflare account
Go to **cloudflare.com** → Sign up (free)

### 3.2 Add your domain to Cloudflare
- In Cloudflare dashboard → **Add a Site** → enter your domain
- Choose the **Free plan**
- Cloudflare will show you two nameservers (e.g. `uma.ns.cloudflare.com`)
- Go to wherever you bought your domain → find **Nameservers** setting → replace them with Cloudflare's two nameservers
- Click Save. Takes up to 30 min to propagate (usually faster)

### 3.3 Create a named tunnel
Open Terminal and run these one by one:

```bash
cd ~/ai-hype-machine
```

```bash
cloudflared tunnel login
```
(opens browser — log in to Cloudflare)

```bash
cloudflared tunnel create ai-hype-machine
```
(creates a permanent tunnel — copy the tunnel ID it shows you)

```bash
# Replace YOUR_TUNNEL_ID and yourdomain.com with your actual values
cloudflared tunnel route dns ai-hype-machine yourdomain.com
```

### 3.4 Create tunnel config file
Run this, replacing `YOUR_TUNNEL_ID` and `yourdomain.com`:
```bash
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: YOUR_TUNNEL_ID
credentials-file: /Users/$(whoami)/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
EOF
```

### 3.5 Update start.sh to use named tunnel
Open Terminal:
```bash
cd ~/ai-hype-machine
```
Open the file in TextEdit:
```bash
open -a TextEdit start.sh
```
Find this line:
```
cloudflared tunnel --url "http://localhost:$PORT" 2>&1 | tee "$TUNNEL_LOG" &
```
Replace it with:
```
cloudflared tunnel run ai-hype-machine 2>&1 | tee "$TUNNEL_LOG" &
```
Save and close TextEdit.

### 3.6 Test with domain
```bash
./start.sh --tunnel
```
Wait ~30 seconds, then open `https://yourdomain.com` in your browser.
Share the link with friends!

---

## Part 4 — Keep it running (5 min)

Your Mac will go to sleep and kill the game. Fix that:

### 4.1 Disable sleep while the game is running
- Open **System Settings** → **Battery** (or Energy Saver on older macOS)
- Set **"Prevent automatic sleeping when display is off"** to ON
- Or use the menu bar battery icon → Options → Prevent Sleep

### 4.2 Keep the lid closed but awake (optional)
If you want to close the lid and still host:
```bash
brew install displayplacer  # ignore this, wrong tool
```
Actually just use **Amphetamine** — it's free on the Mac App Store. Keeps Mac awake even with lid closed.

---

## Part 5 — Troubleshooting

**Game doesn't load at localhost:3000**
```bash
cd ~/ai-hype-machine
./start.sh
```
Look at the red error messages.

**"npm not found" or "node not found"**
```bash
brew install node
```

**Cloudflare tunnel not connecting**
Make sure you ran `cloudflared tunnel login` and the DNS has propagated.
Check propagation at: **dnschecker.org** (type your domain, look for Cloudflare nameservers)

**Game crashes / weird errors**
```bash
cd ~/ai-hype-machine
git pull         # get latest fixes
npm install --workspaces --include-workspace-root
./start.sh --tunnel
```

**Start fresh (wipe all game data)**
```bash
cd ~/ai-hype-machine
rm -f data/game.db
./start.sh --tunnel
```

---

## Part 6 — Share it

Once it's live, share the link. Tell people:
- Enter a name to start
- Click the button to generate tokens
- Buy hardware → buy models → get hype → attract investors
- "Launch a Startup" once you hit 1M total tokens (prestige)
- There's a leaderboard

---

## Quick reference — daily use

Start the game:
```bash
cd ~/ai-hype-machine && ./start.sh --tunnel
```

Stop the game: `Ctrl+C` in Terminal

Get latest updates:
```bash
cd ~/ai-hype-machine && git pull && ./start.sh --tunnel
```
