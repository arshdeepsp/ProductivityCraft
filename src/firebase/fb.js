/* The Firebase facade. Bundled by build.mjs (esbuild) into dist/vendor/firebase.js and imported on demand by
   54-account-sync.js, so the app never pays for the SDK until someone signs in. It exposes window.PCFB with the
   small surface the app uses: auth (email/password) and a document store over Firestore with offline persistence.
   Tests replace window.PCFB with an in-memory fake, so keep this surface tiny and plain (paths and plain objects). */
import { initializeApp } from "firebase/app";
import { initializeAuth, getAuth, indexedDBLocalPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, sendEmailVerification, reload, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from "firebase/auth";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentSingleTabManager, doc, collection, getDoc, getDocs, setDoc, writeBatch, onSnapshot, query, where, terminate, clearIndexedDbPersistence } from "firebase/firestore";

let app = null, auth = null, db = null;

function me(u) { return u ? { uid: u.uid, email: u.email, verified: !!u.emailVerified } : null; }
function cur() { const u = auth && auth.currentUser; if (!u) throw Object.assign(new Error("Not signed in"), { code: "auth/no-current-user" }); return u; }

function ref(path) { return doc(db, path); }
function col(path) { return collection(db, path); }
function snap(s) { return { id: s.id, data: s.exists() ? s.data() : null, pending: !!(s.metadata && s.metadata.hasPendingWrites) }; }

const PCFB = {
  init(config) {
    if (app) return;
    app = initializeApp(config);
    /* The session persists in IndexedDB (localStorage as a fallback) and never expires on its own: only signing out,
       deleting the account or changing its password elsewhere ends it. */
    try { auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }); }
    catch (e) { auth = getAuth(app); }
    try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) }); }
    catch (e) { db = getFirestore(app); }
  },
  auth: {
    user() { return me(auth && auth.currentUser); },
    onAuth(cb) { return onAuthStateChanged(auth, (u) => cb(me(u))); },
    signIn(email, password) { return signInWithEmailAndPassword(auth, email, password).then((r) => me(r.user)); },
    /* A new account gets a verification email right away; failing to send it doesn't fail the sign-up. */
    signUp(email, password) { return createUserWithEmailAndPassword(auth, email, password).then((r) => sendEmailVerification(r.user).catch(() => null).then(() => me(r.user))); },
    /* Signing out also wipes Firestore's offline cache, so the account's documents don't stay on the device. The app
       reloads right after, which sets the SDK up again. */
    signOut() { return signOut(auth).then(() => terminate(db)).then(() => clearIndexedDbPersistence(db)).catch(() => null); },
    reset(email) { return sendPasswordResetEmail(auth, email); },
    verify() { return Promise.resolve().then(() => sendEmailVerification(cur())); },
    refresh() { return Promise.resolve().then(() => reload(cur())).then(() => me(auth.currentUser)); },
    reauth(password) { return Promise.resolve().then(() => { const u = cur(); return reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password)); }); },
    changePassword(current, next) { return PCFB.auth.reauth(current).then(() => updatePassword(cur(), next)); },
    deleteUser() { return Promise.resolve().then(() => deleteUser(cur())).then(() => terminate(db).then(() => clearIndexedDbPersistence(db)).catch(() => null)); }
  },
  db: {
    get(path) { return getDoc(ref(path)).then(snap); },
    list(path) { return getDocs(col(path)).then((q) => q.docs.map(snap)); },
    /* Documents in a collection stamped after `since` (u > since): what changed elsewhere since the last pull. */
    listSince(path, since) { return getDocs(query(col(path), where("u", ">", since))).then((q) => q.docs.map(snap)); },
    set(path, data) { return setDoc(ref(path), data); },
    batch(ops) {
      const chunks = []; for (let i = 0; i < ops.length; i += 450) chunks.push(ops.slice(i, i + 450));
      return chunks.reduce((p, part) => p.then(() => { const b = writeBatch(db); part.forEach((o) => b.set(ref(o.path), o.data)); return b.commit(); }), Promise.resolve());
    },
    remove(paths) {
      const chunks = []; for (let i = 0; i < paths.length; i += 450) chunks.push(paths.slice(i, i + 450));
      return chunks.reduce((p, part) => p.then(() => { const b = writeBatch(db); part.forEach((x) => b.delete(ref(x))); return b.commit(); }), Promise.resolve());
    },
    onDoc(path, cb) { return onSnapshot(ref(path), { includeMetadataChanges: true }, (s) => cb(snap(s)), (e) => cb(null, e)); },
    onCol(path, cb) { return onSnapshot(col(path), { includeMetadataChanges: true }, (q) => cb(q.docChanges().map((c) => Object.assign(snap(c.doc), { type: c.type }))), (e) => cb(null, e)); }
  }
};
window.PCFB = PCFB;
export default PCFB;
