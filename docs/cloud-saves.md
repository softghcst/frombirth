# Setting up cloud saves

Cloud saves let a player sign in with an email and password and keep the same
lives, graves and People you know on every device. The game is a static site
on GitHub Pages, so the accounts and the saved copies live on a free
[Supabase](https://supabase.com) project that you own.

Until this is done the game works as before, and **Settings → Transfer saves**
moves lives between devices without any account.

It takes about ten minutes. Supabase's dashboard changes from time to time, so
a menu may have a slightly different name from the one below.

## 1. Make a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up (signing in with GitHub is quickest).
2. Choose **New project**.
   - Name: `from-birth`
   - Database password: press **Generate a password** and keep it somewhere safe.
     The game never needs it.
   - Region: the one nearest to you.
   - Plan: Free.
3. Wait a minute or two while it starts.

## 2. Make the table

1. In the left-hand menu open **SQL Editor**, and start a new query.
2. Paste in everything from [`cloud-saves.sql`](cloud-saves.sql) and press **Run**.
3. It should say *Success. No rows returned.*

## 3. Set up sign-in

1. Open **Authentication → Sign In / Providers** (on older dashboards, **Providers**),
   and make sure **Email** is turned on.
2. In the same place, turn **Confirm email** off. Players can then sign in as
   soon as they make an account. (If you leave it on, new players get an email
   with a link to click first, and Supabase's built-in email only sends a few
   an hour.)
3. Open **Authentication → URL Configuration**:
   - **Site URL:** `https://softghcst.github.io/frombirth/`
   - Under **Redirect URLs**, add the same address.

   This is where "Forgot your password?" links send people back to.

## 4. Copy two values into the game

1. Open **Project Settings → API Keys** (or **Project Settings → API**). Copy:
   - the **Project URL**, which looks like `https://abcdefghijkl.supabase.co`
     (on some dashboards it is under **Project Settings → Data API**);
   - the **publishable** key (`sb_publishable_…`). On older projects it is
     called the **anon public** key (a long `eyJ…` string).

   **Never** copy the *secret* or *service_role* key into the game: that one
   can read everybody's saves.
2. Put them in [`js/sync/config.js`](../js/sync/config.js):

   ```js
   export const CLOUD = {
     url: 'https://abcdefghijkl.supabase.co',
     key: 'sb_publishable_…',
   };
   ```

   You can edit the file on GitHub (open it, press the pencil icon, then
   **Commit changes**), or send the two values to whoever looks after the code.

The publishable key is meant to be public. What keeps saves private is the
row-level security set up in step 2: a player can only ever reach the row
that belongs to their own account.

## Using it

- **Settings → Cloud saves** to make an account or sign in. Whatever is already on the device is kept and added to the account.
- Saves go up a few seconds after each one is made, when the game is closed or hidden, and when the connection comes back. They come down whenever the game is opened.
- Where two devices have played the same life, the one played most recently is kept. Different lives, graves and people are all kept. Something deleted on one device is deleted on the others.
- The "age down" history is not synced: you can only take back years on the device where you lived them.
- **Sign out** keeps everything on the device. **Delete my saves from the cloud** removes the copy in the account.

## Things to know

- **Free projects pause after about a week without use.** The game carries on
  with saves on each device. To wake it, open the project in the Supabase
  dashboard and press **Restore**; syncing then picks up where it left off.
- To see who has an account, open **Authentication → Users**. Deleting a user
  there also deletes their saves.
- The saved copy is compressed text in the `saves` table (**Table Editor → saves**).
  A long-running family is typically a few hundred kilobytes, well inside the free tier.
