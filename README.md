# T

T is a WhatsApp bot powered by the live TKM-API catalog at `cod3uchiha.com`.

## Main behavior

- Loads every currently published API endpoint from `https://cod3uchiha.com/catalog`.
- Automatically creates a WhatsApp command for every endpoint.
- Refreshes the catalog every 10 minutes.
- Retries the catalog when an unknown command is used.
- Keeps disabled or retired endpoints out because they are not published in the catalog.
- Sends JSON, text, images, audio, video, SVG, PDF, and other files using the endpoint response type.
- Uses no external API origin directly other than `cod3uchiha.com`.

## Dynamic command names

Every endpoint gets a command based on its full route:

- `/ai/FluxLora` becomes `.ai-fluxlora`
- `/tools/base64` becomes `.tools-base64`
- `/downloaders/books` becomes `.downloaders-books`

When an endpoint basename is unique and does not conflict with a built-in command, T also adds a shorter alias. For example, `.base64` can point to `.tools-base64`.

Use `.menu` to show every loaded command. Use `.menu api-tools` to show one API category.

## Parameters

Named parameters are recommended and may contain spaces:

```text
.tools-base64 mode=encode text=Hello from T
.tools-trt text=How are you? language=sn
.ai-fluxlora prompt=A futuristic city in Zimbabwe width=1024 height=1024 seed=42
```

You can also separate positional parameters with `|`:

```text
.tools-base64 encode | Hello from T
```

## Built-in shortcuts

- `.play <query>`
- `.song <query>`
- `.video <query>`
- `.sticker`
- `.menu`
- `.ping`
- `.alive`
- `.api`
- `.apirefresh` — owner only

Group administration commands include `.tagall`, `.hidetag`, `.mute`, `.unmute`, `.kick`, `.promote`, `.demote`, and `.delete`.

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Example `.env`:

```env
PREFIX=.
OWNER_NUMBER=263000000000
PAIRING_NUMBER=263000000000
SESSION_DIRECTORY=./session
LOG_LEVEL=info
```

`PAIRING_NUMBER` should contain digits only. On first start, the terminal prints the WhatsApp pairing code.

## Validation

```bash
npm test
```

The audit rejects old branding and hardcoded runtime API origins outside `cod3uchiha.com`.
