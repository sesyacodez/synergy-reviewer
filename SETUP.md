# Synergy Reviewer — Setup Guide

## Quick Start (5 хвилин)

### 1. Клонуй репо

```bash
git clone https://github.com/sesyacodez/synergy-reviewer.git
cd synergy-reviewer
npm install
```

### 2. Створи `.env` файл

```bash
cp .env.example .env
```

Заповни `.env`:

```env
# OpenRouter (безкоштовний ключ — https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-v1-ваш-ключ

# Моделі (ці працюють на free tier)
OPENROUTER_REVIEW_MODELS=google/gemma-3-27b-it:free,google/gemma-3-4b-it:free,openai/gpt-oss-120b:free
OPENROUTER_SYNTH_MODEL=openai/gpt-oss-120b:free

# GitHub App
GITHUB_APP_ID=3325698
GITHUB_APP_INSTALLATION_ID=122628762
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_WEBHOOK_SECRET=synergy-secret-2026

AGENT_COUNT=3
```

> **GITHUB_APP_PRIVATE_KEY** — вставляй весь ключ в одну стрічку, замінюючи переноси рядків на `\n`

### 3. Запусти smee proxy (для отримання webhooks)

```bash
node smee-proxy.js
```

Має написати: `[smee-proxy] Connected! Waiting for webhooks...`

### 4. Запусти сервер (в іншому терміналі)

```bash
SKIP_ENV_VALIDATION=1 npm run dev
```

Має написати: `✓ Ready in 3s` на `http://localhost:3000`

### 5. Тестуй

1. Створи PR в будь-якому репо де встановлений GitHub App
2. Напиши коментар: `@synergy-reviewer-test review this PR`
3. Зачекай 30-60 секунд
4. Бот відповість з детальним review

## Як це працює

```
Коментар "@synergy-reviewer-test" в PR
    │
    ▼
GitHub → Webhook → smee.io → smee-proxy.js → localhost:3000
    │
    ▼
Orchestrator клонує репо, отримує diff
    │
    ├──► Agent 1 (Gemma 27B)     ─── аналізує diff
    ├──► Agent 2 (Gemma 4B)      ─── аналізує diff
    └──► Agent 3 (GPT-OSS 120B)  ─── аналізує diff
    │
    ▼
Synthesizer порівнює знахідки, виставляє confidence
    │
    ▼
Коментар на PR з результатами
```

## Тестовий репо з багами

https://github.com/evlinges/synergy-demo — PR #1 має навмисні баги:
- SQL injection
- Зберігання CVV
- Логування номерів карток
- Refund без авторизації
- Webhook без верифікації підпису

## Зміна моделей

Безкоштовні моделі іноді rate-limited. Якщо не працює — перевір доступні:

```bash
curl -s "https://openrouter.ai/api/v1/models" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
free = [m['id'] for m in data['data'] if ':free' in m['id']]
for m in sorted(free): print(m)
"
```

Протестуй конкретну модель:

```bash
curl -s https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"MODEL_ID_HERE","messages":[{"role":"user","content":"Say OK"}],"max_tokens":5}'
```

Заміни `OPENROUTER_REVIEW_MODELS` в `.env` на працюючі моделі і перезапусти сервер.

## Troubleshooting

| Проблема | Рішення |
|----------|---------|
| `No endpoints found` | Модель більше не доступна, заміни на іншу |
| `429 rate limited` | Зачекай 1-2 хвилини або зміни модель |
| Webhook не приходить | Перевір що `smee-proxy.js` запущений і connected |
| `Invalid signature` | Перевір `GITHUB_APP_WEBHOOK_SECRET` в `.env` |
| Пустий review | Перевір що diff не порожній (PR має зміни) |
