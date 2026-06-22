# Clause & Effect

**AI-powered plain-English contract checks for freelancers, creators & renters in London.**
A student-business concept site with a working **AI review agent** built on Claude Opus 4.8.

Someone pastes a contract → the AI agent reads every line → returns a plain-English summary,
colour-coded clause flags (🔴 red / 🟠 amber / 🟢 green), and exactly what to negotiate.

---

## Two ways to use this

| | What works | Needs |
|---|---|---|
| **Marketing site** (`index.html`) | The whole brochure site — hero, pricing, FAQ, intake form | Nothing — just open the file |
| **AI reviewer** (`review.html`) | The agent that actually reads contracts | Node.js + an Anthropic API key (below) |

---

## Run the AI reviewer — step by step

### 1. Install Node.js (one time)
Download the **LTS** installer from <https://nodejs.org> and run it. Accept the defaults.
(Then close and reopen your terminal so `node` is on the PATH.)

### 2. Add your Anthropic API key
- Get a key at <https://console.anthropic.com> → **API Keys**.
- In the project folder, copy `.env.example` to a new file named exactly `.env`.
- Open `.env` and paste your key after `ANTHROPIC_API_KEY=`.

### 3. Install dependencies & start
Open a terminal **in this folder** and run:
```bash
npm install
npm start
```
Then open **http://localhost:3000** in your browser and click **🤖 AI contract check**.
Use **"Try a sample contract"** to see it work instantly.

> 💡 The site is served by the local server, so always visit `http://localhost:3000`
> (not the `file://` path) when you want the AI reviewer to work.

---

## How the AI part works (and why it's safe)
- **`server.js`** is a tiny Express server. It serves the website *and* exposes one endpoint, `POST /api/review`.
- That endpoint calls **Claude Opus 4.8** with a fixed JSON schema (structured outputs), so the agent always returns a clean, predictable report.
- **Your API key lives only on the server** (in `.env`) — it's never sent to the browser, so visitors can't see or steal it.
- The prompt frames the agent as a *plain-English explainer that signposts to a solicitor* for serious matters — not regulated legal advice.

### A note on cost
Each review is one Claude API call, billed to your Anthropic account (Opus 4.8 pricing).
A typical contract review costs a few pence. Set usage limits in the Anthropic Console if you want a hard cap.

---

## File guide
| File | What it is |
|---|---|
| `index.html` / `styles.css` / `app.js` | The marketing site |
| `review.html` / `review.js` | The AI reviewer page + front-end logic |
| `server.js` | Express server + the AI review endpoint |
| `package.json` | Dependencies (`express`, `@anthropic-ai/sdk`, `dotenv`) |
| `.env.example` | Template for your API key — copy to `.env` |

---

## Going live (free hosting)
The reviewer needs a server, so the marketing-only static hosts (GitHub Pages) won't run the AI part.
Use a host that runs Node: **Render**, **Railway**, or **Fly.io** all have free tiers — push the repo,
set `ANTHROPIC_API_KEY` as an environment variable in their dashboard, and you're live.

## Before trading for real
- Add a privacy policy (you'll be handling people's documents) and a way to delete uploads.
- Keep the "not legal advice / not a substitute for a solicitor" framing front and centre.
- Sanity-check the positioning against **SRA** rules on reserved legal activities.
