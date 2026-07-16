# T

T is a lightweight WhatsApp bot built with Baileys.

## Rules enforced in the source

- The bot identity is **T** everywhere.
- Every command requiring an external API uses `https://cod3uchiha.com`.
- Commands without a verified matching endpoint are not included.
- Local WhatsApp and group-management commands do not require an external API.

## Included commands

General: `menu`, `ping`, `alive`, `owner`, `api`

Group: `groupinfo`, `tagall`, `hidetag`, `mute`, `unmute`, `kick`, `promote`, `demote`, `delete`

Media: `sticker`

TKM-API: `play`, `song`, `video`, `tiktok`, `image`, `pinterest`, `translate`, `emojimix`, `imagine`

## Setup

```bash
cp .env.example .env
npm install
npm test
npm start
```

Set your WhatsApp number in `.env` using international format without `+`.

```env
OWNER_NUMBER=2637XXXXXXXX
PAIRING_NUMBER=2637XXXXXXXX
PREFIX=.
```

When there is no saved session, T prints a pairing code in the terminal.
