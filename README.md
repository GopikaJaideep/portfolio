# Gopika Jaideep · AI/ML engineering portfolio

Live site: **https://gopika-jaideep.netlify.app**

A multi-page portfolio with working AI, not just screenshots of it:

- **RAG agent** — a naive Bayes intent router, BM25 + character-trigram retrieval fused with reciprocal rank fusion, an LLM answer step and a citation verifier, all visible step by step on the RAG Agent page.
- **Assistant Gopika** — a small walking guide that follows the pointer, answers questions about the portfolio and can navigate or run the demos for you.
- **Live evals** — run the eval suite, a CI regression gate, mutation tests and a 500-query red-team replay in the browser.
- **Projects, experience, education and skills** — interactive pages built only from facts in the CV.

## Stack

Plain HTML, CSS and JavaScript (no framework). Hosted on Netlify; `netlify/functions/agent.mjs` relays chat requests to Groq's free tier, so the API key stays on the server. Without a key, the agent falls back to extractive answers.

## Run locally

```bash
python -m http.server 8766
```

Then open http://localhost:8766. For the live LLM locally, put `GROQ_API_KEY=...` in a `.env` file (git-ignored) and run `netlify dev` instead.

## Deploy

Netlify builds from this repo's `main` branch on every push (`netlify.toml` copies the public files into `dist/`). The Groq key is set in Netlify under Project configuration → Environment variables as `GROQ_API_KEY`; a redeploy is needed after changing it.
