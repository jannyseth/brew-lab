# Brew Lab

A coffee shop web app. Customers order from the menu or build their own drink. Branch owners run their branches: orders, workers, clock-in, payroll and a staff chat. A super admin approves branches and oversees everything, with a support inbox for customer questions.

Built with Next.js, Postgres (Neon), Drizzle ORM and Better Auth.

Anyone can run their own copy. Your copy has its own database and you are its admin. It is not connected to anyone else's Brew Lab.

---

## What you need

- **Node.js 20.9 or newer**: https://nodejs.org (check with `node -v`)
- **Git**: https://git-scm.com
- **A free Neon account**: https://neon.tech. Brew Lab uses Neon's database driver, so a regular local PostgreSQL install will **not** work.
- **An authenticator app** on your phone (Google Authenticator, Microsoft Authenticator, Authy…). The admin account must turn on two-factor sign-in.

---

## Setup

### 1. Download the code

```bash
git clone https://github.com/jannyseth/brew-lab.git
cd brew-lab
npm install
```

### 2. Create a database

1. Sign in at https://console.neon.tech and create a new project (any name and region).
2. Click **Connect** and copy the connection string. It starts with `postgresql://`.
3. Optional: turn off **Connection pooling** in the same dialog and copy that string too (the "unpooled" one).

### 3. Fill in your settings

Copy the example settings file:

```bash
cp .env.example .env.local
```

(On Windows Command Prompt use `copy .env.example .env.local`.)

Open `.env.local` and set:

| Setting | What to put |
|---|---|
| `DATABASE_URL` | The Neon connection string from step 2 |
| `DATABASE_URL_UNPOOLED` | The unpooled string (optional) |
| `BETTER_AUTH_SECRET` | A random string. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SUPER_ADMIN_EMAILS` | **Your own email.** Whoever signs up with this email becomes the admin. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Optional. Leave empty and codes appear in the terminal instead of being emailed. |

### 4. Create the tables and load the menu

```bash
npm run db:migrate
npm run db:seed
```

`db:migrate` creates all the tables. `db:seed` loads the sample menu (you can rerun it anytime to reset the menu).

### 5. Start the app

```bash
npm run dev
```

Open http://localhost:3000.

---

## Become the admin

1. Click **Sign up** and use the **same email** you put in `SUPER_ADMIN_EMAILS`.
2. Brew Lab asks for a 6-digit code. If you didn't set up Gmail, look in the terminal running `npm run dev` for a line like:
   ```
   [dev] email-verification code for you@example.com: 123456
   ```
3. Enter the code. You're signed in as the **super admin**.
4. Brew Lab sends you to turn on **two-factor sign-in** before the admin pages open. Scan the QR code with your authenticator app and save the backup codes somewhere safe.

The admin area is now open from the menu in the top corner.

> Added your email to `SUPER_ADMIN_EMAILS` *after* signing up? The role is given at sign-up, so sign up again with a new account, or reset the database and start over.

---

## Try the other roles

| Role | How to get it |
|---|---|
| **Customer** | Sign up and choose a customer account. |
| **Branch owner** | Sign up and choose a branch account, fill in the branch application, then approve it as the super admin. |
| **Worker** | A branch owner creates an invite link from the branch's **Lounge** page; open it and sign up. |
| **Support agent** | The super admin promotes a verified customer account from **Admin → Users**. |

Tip: use a second browser or a private window to be signed in as two people at once.

---

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally at http://localhost:3000 |
| `npm run build` then `npm start` | Run the production build locally |
| `npm test` | Run the tests |
| `npm run lint` | Check the code style |
| `npm run db:migrate` | Apply database changes |
| `npm run db:seed` | Reset and reload the sample menu |

---

## Put it online (optional)

1. Push your copy to your own GitHub repository.
2. Import it at https://vercel.com/new.
3. In the Vercel project's **Settings → Environment Variables**, add the same settings from your `.env.local`. Gmail is **required** online, since codes are only printed to the terminal during `npm run dev`.
4. Deploy.

---

## Troubleshooting

- **`DATABASE_URL is not set`**: `.env.local` is missing or in the wrong folder. It must sit next to `package.json`.
- **No sign-up code**: without Gmail, the code is in the terminal, not your inbox. With Gmail, check your spam folder and that the app password is correct.
- **Not an admin after signing up**: the email must match `SUPER_ADMIN_EMAILS` exactly, and must be there *before* you sign up. Restart `npm run dev` after changing `.env.local`.
- **Admin pages keep sending me to two-factor setup**: that's on purpose. Admin accounts must turn on two-factor sign-in first.
