/* The Firebase facade. Bundled by build.mjs (esbuild) into dist/vendor/firebase.js and imported on demand by
   54-account-sync.js, so the app never pays for the SDK until someone signs in. It exposes window.PCFB with the
   small surface the app uses: auth (email/password) and a document store over Firestore with offline persistence.
   Tests replace window.PCFB with an in-memory fake, so keep this surface tiny and plain (paths and plain objects). */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentSingleTabManager, doc, collection, getDoc, getDocs, setDoc, writeBatch, onSnapshot } from "firebase/firestore";

let app = null, auth = null, db = null;

function ref(path) { return doc(db, path); }
function col(path) { return collection(db, path); }
function snap(s) { return { id: s.id, data: s.exists() ? s.data() : null, pending: !!(s.metadata && s.metadata.hasPendingWrites) }; }

const PCFB = {
  init(config) {
    if (app) return;
    app = initializeApp(config);
    auth = getAuth(app);
    try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }) }); }
    catch (e) { db = getFirestore(app); }
  },
  auth: {
    user() { const u = auth && auth.currentUser; return u ? { uid: u.uid, email: u.email } : null; },
    onAuth(cb) { return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)); },
    signIn(email, password) { return signInWithEmailAndPassword(auth, email, password).then((r) => ({ uid: r.user.uid, email: r.user.email })); },
    signUp(email, password) { return createUserWithEmailAndPassword(auth, email, password).then((r) => ({ uid: r.user.uid, email: r.user.email })); },
    signOut() { return signOut(auth); },
    reset(email) { return sendPasswordResetEmail(auth, email); }
  },
  db: {
    get(path) { return getDoc(ref(path)).then(snap); },
    list(path) { return getDocs(col(path)).then((q) => q.docs.map(snap)); },
    set(path, data) { return setDoc(ref(path), data); },
    batch(ops) {
      const chunks = []; for (let i = 0; i < ops.length; i += 450) chunks.push(ops.slice(i, i + 450));
      return chunks.reduce((p, part) => p.then(() => { const b = writeBatch(db); part.forEach((o) => b.set(ref(o.path), o.data)); return b.commit(); }), Promise.resolve());
    },
    onDoc(path, cb) { return onSnapshot(ref(path), { includeMetadataChanges: true }, (s) => cb(snap(s)), (e) => cb(null, e)); },
    onCol(path, cb) { return onSnapshot(col(path), { includeMetadataChanges: true }, (q) => cb(q.docChanges().map((c) => Object.assign(snap(c.doc), { type: c.type }))), (e) => cb(null, e)); }
  }
};
window.PCFB = PCFB;
export default PCFB;
