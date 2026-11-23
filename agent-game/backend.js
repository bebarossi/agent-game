// Real-time layer. Two implementations with the same interface:
//  - firebase: Firebase Realtime Database (phones anywhere, anonymous sign-in; presenter signs in with Google)
//  - demo: localStorage + BroadcastChannel (only tabs of the same browser; for rehearsal and testing)
//
// Interface:
//   mode, uid, isPresenter, now()
//   onState(cb)                      cb({phase, caseKey, deadline})
//   setState(patch)                  presenter only
//   onVotes(caseKey, cb)             cb({uid: {c, t}}), presenter only in firebase mode
//   onMyVote(caseKey, cb)            cb(choice | null)
//   vote(caseKey, choice)            choice in 'A' | 'B' | 'C'
//   resetVotes()                     presenter only
//   joinPresence()                   phones
//   onPresenceCount(cb)              cb(n)
//   signInPresenter(), signOut()     firebase only

import { FIREBASE_CONFIG, PRESENTER_EMAIL } from "./config.js?v=5";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";

export async function connect(role) {
  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL) return firebaseBackend(role);
  return demoBackend(role);
}

// ---------------------------------------------------------------- firebase
async function firebaseBackend(role) {
  const { initializeApp } = await import(SDK + "firebase-app.js");
  const db_ = await import(SDK + "firebase-database.js");
  const au = await import(SDK + "firebase-auth.js");
  const app = initializeApp(FIREBASE_CONFIG);
  const db = db_.getDatabase(app);
  const auth = au.getAuth(app);

  let offset = 0;
  db_.onValue(db_.ref(db, ".info/serverTimeOffset"), (s) => { offset = s.val() || 0; });

  // Wait for the first auth answer; phones sign in anonymously.
  let user = await new Promise((res) => { const off = au.onAuthStateChanged(auth, (u) => { off(); res(u); }); });
  if (role === "voter" && !user) user = (await au.signInAnonymously(auth)).user;

  const api = {
    mode: "firebase",
    get uid() { return auth.currentUser ? auth.currentUser.uid : null; },
    get isPresenter() {
      const u = auth.currentUser;
      return !!(u && u.email && PRESENTER_EMAIL && u.email.toLowerCase() === PRESENTER_EMAIL.toLowerCase());
    },
    get presenterEmail() { return auth.currentUser && auth.currentUser.email; },
    now: () => Date.now() + offset,
    onState(cb) { return db_.onValue(db_.ref(db, "state"), (s) => cb(s.val() || { phase: "lobby" })); },
    setState(patch) { return db_.update(db_.ref(db, "state"), patch); },
    onVotes(caseKey, cb) {
      return db_.onValue(db_.ref(db, "votes/" + caseKey), (s) => cb(s.val() || {}), () => cb({}));
    },
    onMyVote(caseKey, cb) {
      return db_.onValue(db_.ref(db, "votes/" + caseKey + "/" + api.uid), (s) => cb(s.val() ? s.val().c : null), () => cb(null));
    },
    vote(caseKey, choice) {
      return db_.set(db_.ref(db, "votes/" + caseKey + "/" + api.uid), { c: choice, t: db_.serverTimestamp() });
    },
    resetVotes() { return db_.remove(db_.ref(db, "votes")); },
    joinPresence() {
      const me = db_.ref(db, "presence/" + api.uid);
      db_.onValue(db_.ref(db, ".info/connected"), (s) => {
        if (s.val() === true) { db_.onDisconnect(me).remove(); db_.set(me, true); }
      });
    },
    onPresenceCount(cb) { return db_.onValue(db_.ref(db, "presence"), (s) => cb(s.size || 0)); },
    async signInPresenter() { await au.signInWithPopup(auth, new au.GoogleAuthProvider()); },
    async signOut() { await au.signOut(auth); },
    onAuth(cb) { return au.onAuthStateChanged(auth, cb); },
  };
  return api;
}

// ---------------------------------------------------------------- demo
function demoBackend(role) {
  const KEY = "ddm-vote-demo";
  const chan = "BroadcastChannel" in window ? new BroadcastChannel(KEY) : null;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (fn) => {
    const s = read(); fn(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
    fire();
  };
  const listeners = new Set();
  const fire = () => { listeners.forEach((f) => f()); if (chan) chan.postMessage(1); };
  if (chan) chan.onmessage = () => listeners.forEach((f) => f());
  window.addEventListener("storage", (e) => { if (e.key === KEY) listeners.forEach((f) => f()); });
  const sub = (f) => { listeners.add(f); f(); return () => listeners.delete(f); };

  let uid;
  try { uid = sessionStorage.getItem(KEY + "-uid"); } catch {}
  if (!uid) { uid = "demo-" + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem(KEY + "-uid", uid); } catch {} }

  const api = {
    mode: "demo",
    uid,
    isPresenter: true,
    presenterEmail: null,
    now: () => Date.now(),
    onState(cb) { return sub(() => cb(read().state || { phase: "lobby" })); },
    setState(patch) { write((s) => { s.state = Object.assign({}, s.state || { phase: "lobby" }, patch); }); return Promise.resolve(); },
    onVotes(caseKey, cb) { return sub(() => cb((read().votes || {})[caseKey] || {})); },
    onMyVote(caseKey, cb) { return sub(() => { const v = ((read().votes || {})[caseKey] || {})[uid]; cb(v ? v.c : null); }); },
    vote(caseKey, choice) {
      const st = read().state || {};
      if (st.phase !== "vote" || st.caseKey !== caseKey || Date.now() > st.deadline + 2000) return Promise.reject(new Error("closed"));
      write((s) => { s.votes = s.votes || {}; s.votes[caseKey] = s.votes[caseKey] || {}; s.votes[caseKey][uid] = { c: choice, t: Date.now() }; });
      return Promise.resolve();
    },
    resetVotes() { write((s) => { s.votes = {}; }); return Promise.resolve(); },
    // Demo only: adds fake voters so the presenter screen can be rehearsed alone.
    simulateVotes(caseKey, n) {
      write((s) => {
        s.votes = s.votes || {}; s.votes[caseKey] = s.votes[caseKey] || {};
        for (let i = 0; i < n; i++) {
          const r = Math.random();
          s.votes[caseKey]["sim-" + Math.random().toString(36).slice(2, 9)] = { c: r < 0.45 ? "A" : r < 0.8 ? "B" : "C", t: Date.now() };
        }
      });
    },
    joinPresence() {
      const beat = () => write((s) => { s.presence = s.presence || {}; s.presence[uid] = Date.now(); });
      beat(); setInterval(beat, 4000);
      window.addEventListener("pagehide", () => write((s) => { if (s.presence) delete s.presence[uid]; }));
    },
    onPresenceCount(cb) {
      const count = () => Object.values(read().presence || {}).filter((t) => Date.now() - t < 10000).length;
      setInterval(() => cb(count()), 3000);
      return sub(() => cb(count()));
    },
    async signInPresenter() {},
    async signOut() {},
    onAuth(cb) { cb(null); return () => {}; },
  };
  return api;
}
