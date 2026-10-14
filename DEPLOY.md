# Deploying the portfolio on Netlify (with the free RAG agent)

The site is static, except for one serverless function, `netlify/functions/agent.mjs`, which gives the
RAG agent a free LLM (an open model on Groq). Without it the agent still works in search-only mode.

## 1. Get a free Groq API key
1. Sign up at https://console.groq.com (no credit card).
2. Go to **API Keys → Create API key** and copy it (it starts with `gsk_`).

## 2. Deploy (functions need Git or the CLI; drag-and-drop uploads skip them)
**Option A: GitHub (recommended)**
1. Push this whole `Portfolio` folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project →** pick the repo.
   Leave the build settings blank; `netlify.toml` already sets the publish folder, functions folder and a
   one-line build step that adds `<!doctype html>` to `index.html`.

**Option B: Netlify CLI**
```
npm install -g netlify-cli
netlify login
netlify deploy --build --prod
```
Run these from inside the `Portfolio` folder.

## 3. Add the key
Netlify → your site → **Site configuration → Environment variables → Add a variable**
- Key: `GROQ_API_KEY`, Value: your `gsk_...` key
- Optional: `GROQ_MODEL` to pin a model (default `openai/gpt-oss-20b`, with fallbacks `qwen/qwen3.8-27b` and `openai/gpt-oss-120b`)

Then **Deploys → Trigger deploy** so the function picks up the key.

## 4. Check it
Open `https://<your-site>.netlify.app/api/agent` in a browser. You should see `{"ok":true,...}`.
On the RAG Agent page the pill should read **● LLM agent ready · open model**.

## How the agent chooses a model
1. Inside claude.ai (the artifact preview): Claude, on the viewer's own account.
2. On Netlify: the free open model through `/api/agent`.
3. If neither is available (no key, Groq limit reached): search-only answers, word for word, with citations.

## Limits and safety
- Groq's free tier allows roughly 30 requests/minute and 1,000/day per model. If one model is busy or
  retired, the function moves to the next.
- The function only accepts a short question plus portfolio passages and writes its own instructions, so it
  can't be used as a general chatbot. It also limits each visitor to 15 requests a minute.
- Your key is only ever on Netlify's server. Never put it in the HTML or JavaScript.
