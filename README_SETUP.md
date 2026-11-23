# "You are the news agent": live experiment for the presentation

Two files:
- `index.html`: the big screen, run by the presenter
- `vote.html`: the voting page, opened by phones through the QR code

Votes go through Firebase (free) and the site is hosted on GitHub Pages (free). Setup takes about 20 minutes, once.

---

## A. Firebase (about 10 minutes)

1. Go to https://console.firebase.google.com and sign in with your Google account → **Create a project** (for example `ddm-agent-game`). Google Analytics is not needed: turn it off.
2. In the left menu: **Build → Realtime Database → Create database**. Location: **Belgium (europe-west1)**. Choose **Start in locked mode** → Enable.
3. Still in Realtime Database, open the **Rules** tab. Delete what is there and paste the whole content of `database.rules.json`, then replace **all 3** occurrences of `PRESENTER_EMAIL_HERE` with your Gmail address, in lowercase. Click **Publish**.
4. **Build → Authentication → Get started → Sign-in method**:
   - enable **Anonymous** → Save
   - enable **Google**, choose your email as the support email → Save
5. Gear icon at the top left → **Project settings → General**. Under "Your apps", click the web icon **`</>`**, give it a name and click **Register app** (Firebase Hosting is not needed). Firebase shows a `firebaseConfig` block.
6. Open `config.js` with TextEdit (Format → Make Plain Text) and copy in `apiKey`, `authDomain`, `databaseURL`, `projectId` and `appId`. In `PRESENTER_EMAIL`, write the same Gmail as in the rules.
   If `databaseURL` is missing from the block, copy it from the top of the Realtime Database page (it looks like `https://ddm-agent-game-default-rtdb.europe-west1.firebasedatabase.app`).

> The `apiKey` of a Firebase web app is not a secret password: it is public by design. What protects the data are the rules from step 3.

## B. GitHub Pages (about 5 minutes)

1. On https://github.com: **New repository**, named for example `agent-game`, **Public** → Create repository.
2. Click **uploading an existing file** and drag in **all the files** of this folder (not the folder itself), including the already filled-in `config.js` → **Commit changes**.
3. **Settings → Pages**, under "Build and deployment": Source **Deploy from a branch**, branch **main**, folder **/(root)** → Save. After 1-2 minutes the site is live at
   `https://YOUR-USERNAME.github.io/agent-game/`
4. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain** → `YOUR-USERNAME.github.io` (without https and without the repository name).

## C. Test (5 minutes, do it before presentation day)

1. On your laptop open `https://YOUR-USERNAME.github.io/agent-game/` → **Sign in with Google** with the presenter account. You should see the screen with the QR code; the badge at the bottom left says `LIVE · your-email`.
2. Scan the QR with two phones, one of them on mobile data. "2 phones connected" appears on the screen.
3. Press **Space** to move forward, vote from the phones, and check that the votes arrive and the reveal works.
4. At the end press **Reset votes**.

## D. On presentation day

- Open the page in Chrome on the laptop connected to the projector, sign in, press **F** for full screen.
- Press **Reset votes** before starting (it clears the test votes).
- Keys: **Space** or **→** forward, **←** back, **F** full screen. The buttons at the bottom left appear when the mouse goes over them.
- Sequence: lobby with QR → case 1 (explain the chart) → **Space** opens the 60 seconds → **Space** reveal → case 2 → … → final comparison.
  If you press Space before the 60 seconds are over, voting closes straight away.
- The laptop needs internet. If the university wifi does not work, the phones can vote on mobile data.
- The free Firebase plan allows 100 phones connected at the same time: enough for the class.

## Content

- Case 1: Intuitive Surgical – Stryker, 25 Sep 2026, signal 9:45 (signal_id 80 of `Results/test`). The agent blocks; the trade would have made +37.5 bps.
- Case 2: Salesforce – Workday, 20 Oct 2026, signal 9:50 (signal_id 353). The agent blocks; the trade would have lost −95.2 bps.
- Prices: `pairs_intraday_v2`, change from the previous close. The z-score is recomputed with the rules of `signals.py` (continuous EMA, 60-minute half-life) and matches `signals_test.csv`.
- The result of each choice in dollars = gross bps with $10,000 on each leg, as on slide 7. "Bet it widens" is the opposite trade with the same entry and exit.
- Without Firebase (`config.js` empty) the page runs in DEMO mode: it works only between tabs of the same browser, with a "+20 test votes" button for rehearsing alone.
