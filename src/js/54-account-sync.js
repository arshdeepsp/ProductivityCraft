  /* ---- account and cloud sync (Firebase: email/password auth + Firestore) ----
     Nothing here runs until someone signs in. cloud.boot() on startup: if pc-account says a user was signed in on this
     device, the SDK (vendor/firebase.js, built from src/firebase/fb.js) is imported and auth restores the session.
     Data layout: users/<uid>/data/cfg, users/<uid>/data/refl, users/<uid>/days/<date> (document paths need an even number of segments). Every document carries u (ms, the store's
     stamp); a removed day is written as {del:true, u} so other devices delete it too. Merge rule per doc: the newer u
     wins; a local doc with no stamp counts as 0 (data from before the store). Local writes keep going to localStorage
     through the local adapter; the cloud adapter wraps it and pushes the changed docs. Remote changes arrive by
     snapshot listeners and are adopted through store.adopt (no re-push). Tests replace window.PCFB with a fake. */
  var FIREBASE_CONFIG={apiKey:"AIzaSyA4UK9_-Ujodg0nYmj8wA9ILt-zNMxT63U",authDomain:"productivitycraft.firebaseapp.com",projectId:"productivitycraft",storageBucket:"productivitycraft.firebasestorage.app",messagingSenderId:"632131334250",appId:"1:632131334250:web:03d4a81e706eb9cc551a13"};
  var ACCOUNT_KEY="pc-account";
  var cloud=(function(){
    var fb=null,user=null,unsub=[],state={status:"off",last:0,err:"",pending:0},listeners=[],pushing=false,queue={},startP=null;
    function acct(){return cloudAccount()}
    function setAcct(a){try{if(a)localStorage.setItem(ACCOUNT_KEY,JSON.stringify(a));else localStorage.removeItem(ACCOUNT_KEY)}catch(x){}}
    function emit(){listeners.forEach(function(f){try{f(state)}catch(x){}})}
    function setStatus(s,err){state.status=s;state.err=err||"";emit()}
    function lib(){if(fb)return Promise.resolve(fb);if(window.PCFB){fb=window.PCFB;fb.init(FIREBASE_CONFIG);return Promise.resolve(fb)}
      return import("./vendor/firebase.js").then(function(){fb=window.PCFB;fb.init(FIREBASE_CONFIG);return fb})}
    function base(){return "users/"+user.uid}
    function strip(o){return JSON.parse(JSON.stringify(o))}
    /* Firestore document paths need an even number of segments: cfg and refl live in users/<uid>/data/, days in users/<uid>/days/. */
    function docPath(id){return id==="cfg"||id==="refl"?base()+"/data/"+id:base()+"/"+id}
    function localDoc(id){if(id==="cfg")return S.cfg;if(id==="refl")return {map:S.refl};if(id.indexOf("days/")===0)return S.days[id.slice(5)]||null;return null}
    /* Stamps are ms timestamps: never |0 them (that truncates to 32 bits). */
    function stampOf(id){return +((S.meta&&S.meta.u&&S.meta.u[id])||0)}
    function tombOf(id){return +((S.meta&&S.meta.del&&S.meta.del[id])||0)}
    /* Push one doc (or its tombstone) with its stamp; stamp an unstamped local doc now. */
    function op(id){var d=tombOf(id),l=localDoc(id);if(!l&&d)return{path:docPath(id),data:{del:true,u:d}};if(!l)return null;var u=stampOf(id);if(!u){u=Date.now();S.meta.u[id]=u}var data=strip(l);data.u=u;delete data.del;return{path:docPath(id),data:data}}
    function flushQueue(){if(pushing||!user||!fb)return;var ids=Object.keys(queue);if(!ids.length)return;queue={};pushing=true;var ops=ids.map(op).filter(Boolean);state.pending=ids.length;setStatus("syncing");
      fb.db.batch(ops).then(function(){pushing=false;state.last=Date.now();state.pending=0;setStatus("on");flushQueue()},function(e){pushing=false;ids.forEach(function(i){queue[i]=true});setStatus("error",String(e&&e.message||e))})}
    var cloudAdapter={name:"cloud",load:function(){return localAdapter.load()},save:function(state0,changed){localAdapter.save(state0);changed.forEach(function(id){if(id==="session")return;queue[id.charAt(0)==="-"?id.slice(1):id]=true});setTimeout(flushQueue,250)}};
    /* A local doc with nothing in it (the default cfg a fresh install makes, a day with only an auto snapshot, no reflections) never beats a remote doc, whatever its stamp: startup housekeeping stamps docs too, and that must not overwrite real data from another device. */
    function emptyLocal(id){var l=localDoc(id);if(!l)return true;if(id==="cfg")return !(l.quests||[]).length&&!(l.subjects||[]).length&&!(l.rules||[]).length;if(id==="refl")return !Object.keys(l.map||{}).length;return Object.keys(l).every(function(f){return f==="q"||f==="ck"||f==="schSkip"})}
    /* Adopt a remote doc: newer than ours wins; our newer copy gets pushed instead. */
    function takeRemote(id,data){if(!data)return false;var ru=+(data.u||0),lu=stampOf(id),ld=tombOf(id);
      if(data.del){if(ru>Math.max(lu,ld)&&localDoc(id)){store.adopt(id,null,ru);return true}return false}
      if(ld&&ld>ru){queue[id]=true;return false}
      if(emptyLocal(id)&&!(ld&&ld>ru)){var d0=strip(data);delete d0.u;delete d0.del;store.adopt(id,id==="refl"?(d0.map||{}):d0,ru);return true}
      if(ru>lu){var d=strip(data);delete d.u;delete d.del;store.adopt(id,id==="refl"?(d.map||{}):d,ru);return true}
      if(lu>ru){queue[id]=true}return false}
    /* First merge after sign-in: everything remote vs everything local, then push what's newer here. */
    function merge(){setStatus("syncing");return Promise.all([fb.db.get(docPath("cfg")),fb.db.get(docPath("refl")),fb.db.list(base()+"/days")]).then(function(r){var seen={cfg:1,refl:1},ch=false;
      if(takeRemote("cfg",r[0].data))ch=true;else if(S.cfg&&!r[0].data)queue.cfg=true;
      if(takeRemote("refl",r[1].data))ch=true;else if(!r[1].data&&Object.keys(S.refl||{}).length)queue.refl=true;
      r[2].forEach(function(s){var id="days/"+s.id;seen[id]=1;if(takeRemote(id,s.data))ch=true});
      Object.keys(S.days).forEach(function(k){var id="days/"+k;if(!seen[id])queue[id]=true});
      Object.keys((S.meta&&S.meta.del)||{}).forEach(function(id){if(!seen[id])queue[id]=true});
      if(ch){cache();qSig="";render()}flushQueue();if(!Object.keys(queue).length&&!pushing)setStatus("on")})}
    function listen(){unsub.push(fb.db.onDoc(docPath("cfg"),function(s,e){if(e){setStatus("error",String(e.message||e));return}if(!s||s.pending)return;if(takeRemote("cfg",s.data)){cache();qSig="";render()}flushQueue()}));
      unsub.push(fb.db.onDoc(docPath("refl"),function(s,e){if(e||!s||s.pending)return;if(takeRemote("refl",s.data)){cache();render()}flushQueue()}));
      unsub.push(fb.db.onCol(base()+"/days",function(ch,e){if(e||!ch)return;var any=false;ch.forEach(function(s){if(s.pending)return;if(takeRemote("days/"+s.id,s.data))any=true});if(any){cache();qSig="";render()}flushQueue()}))}
    /* start() is reached twice on a sign-in when boot's auth listener is live (the SDK notifies it before the sign-in promise resolves): the same uid reuses the first run. Listeners attach only once the first merge has gone through (syncNow attaches them after a later successful one). */
    function start(u){if(user&&user.uid===u.uid&&startP)return startP;user=u;setAcct({uid:u.uid,email:u.email});store.use(cloudAdapter);setStatus("syncing");startP=Promise.resolve().then(merge).then(function(){if(user&&!unsub.length)listen();if(typeof welcomeCheck==="function")welcomeCheck(0)},function(e){setStatus("error",String(e&&e.message||e))});return startP}
    function stop(){unsub.forEach(function(f){try{f()}catch(x){}});unsub=[];user=null;startP=null;queue={};store.use(localAdapter);setStatus("off")}
    /* Changes not yet in the cloud: queued or in flight, or sync not up to date. */
    /* leaving: this device is deleting the account; the SDK's own "signed out" callback must not reload first. */
    var leaving=false;
    function unsynced(){return Object.keys(queue).length+(pushing?1:0)+(user&&state.status!=="on"?1:0)}
    /* After auth succeeds: pick this account's copy on the device and reload into it. A new account takes the data made
       without an account (the guest copy). Signing in to an account that has nothing in the cloud does too; one that
       already has data loads its own copy (or starts empty and pulls everything), and the guest copy stays put. */
    function enter(u,isNew){var key="pc-cache-u-"+u.uid,has=false;try{has=localStorage.getItem(key)!==null}catch(x){}
      var p=isNew?Promise.resolve(true):has?Promise.resolve(false):Promise.resolve().then(function(){return Promise.all([fb.db.get("users/"+u.uid+"/data/cfg"),fb.db.list("users/"+u.uid+"/days")])}).then(function(r){return !r[0].data&&!r[1].length},function(){return false});
      return p.then(function(take){cache();storeHold=true;try{if(take&&!has){var g=localStorage.getItem("pc-cache-v1");if(g!==null)localStorage.setItem(key,g);localStorage.removeItem("pc-cache-v1")}}catch(x){}setAcct({uid:u.uid,email:u.email});reloadApp(isNew?"Account created. Check your inbox to verify your email.":"Signed in.");return u})}
    function reloadApp(note){try{sessionStorage.setItem("pc-authnote",note||"")}catch(x){}setTimeout(function(){location.reload()},0)}
    return{
      state:state,on:function(f){listeners.push(f)},user:function(){return user},account:acct,
      boot:function(){if(!acct())return;setStatus("connecting");lib().then(function(f){f.auth.onAuth(function(u){if(u){if(!user||user.uid!==u.uid){if(user)stop();start(u)}else user.verified=u.verified}else{if(leaving)return;var had=!!user||!!acct();if(user)stop();if(had){storeHold=true;setAcct(null);reloadApp("You were signed out. Sign in again to see your data; it's kept on this device until you do.")}else{setAcct(null);setStatus("off")}}})},function(e){setStatus("error","Couldn’t load the sync library: "+String(e&&e.message||e))})},
      signIn:function(email,pw){return lib().then(function(f){return f.auth.signIn(email,pw)}).then(function(u){return enter(u,false)})},
      signUp:function(email,pw){return lib().then(function(f){return f.auth.signUp(email,pw)}).then(function(u){return enter(u,true)})},
      reset:function(email){return lib().then(function(f){return f.auth.reset(email)})},
      /* Sign out removes this account's copy from the device. Refused while a timer or sprint runs (they belong to the
         account's data), and while changes haven't reached the cloud unless force (the UI asks first). */
      signOut:function(force){if(S.timer||(S.sprint&&S.sprint.phase!=="done"))return Promise.reject({code:"app/timer"});var n=unsynced();if(n&&!force)return Promise.reject({code:"app/unsynced",n:n});
        var f=fb,u=user||acct();stop();storeHold=true;try{if(u)localStorage.removeItem("pc-cache-u-"+u.uid)}catch(x){}setAcct(null);
        return (f?f.auth.signOut():Promise.resolve()).catch(function(){}).then(function(){reloadApp("Signed out. Your data is in your account and comes back when you sign in.")})},
      unsynced:function(){return unsynced()},
      /* Erase this device: every copy (guest and each account's), the rescue copy and the signed-in account, then reload
         to a fresh start on the sign-in page. Accounts keep their data in the cloud. Same timer/unsynced guards as sign-out. */
      eraseDevice:function(force){if(S.timer||(S.sprint&&S.sprint.phase!=="done"))return Promise.reject({code:"app/timer"});var n=user?unsynced():0;if(n&&!force)return Promise.reject({code:"app/unsynced",n:n});
        var f=fb;stop();storeHold=true;try{var ks=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&(k.indexOf("pc-cache-")===0||k==="pc-account"||k==="pc-welcomed"||k==="pc-rerate"))ks.push(k)}ks.forEach(function(k){localStorage.removeItem(k)});sessionStorage.removeItem("pc-noacct")}catch(x){}
        return (f?f.auth.signOut():Promise.resolve()).catch(function(){}).then(function(){reloadApp("This device’s data was erased.")})},
      /* Email verification, password change and account deletion (55 draws the pages). Deleting needs the password again
         (Firebase wants a recent sign-in); sync stops first so nothing is pushed back while the documents go, then every
         users/<uid> document is removed and the Firebase user deleted, then this account's copy on the device. */
      verify:function(){return lib().then(function(f){return f.auth.verify()})},
      refresh:function(){return lib().then(function(f){return f.auth.refresh()}).then(function(u){if(user&&u){user.verified=u.verified;emit()}return u})},
      changePw:function(cur,next){return lib().then(function(f){return f.auth.changePassword(cur,next)})},
      deleteAccount:function(pw){var f,u=user;if(!u)return Promise.reject({code:"auth/no-current-user"});return lib().then(function(x){f=x;return f.auth.reauth(pw)}).then(function(){unsub.forEach(function(g){try{g()}catch(x){}});unsub=[];queue={};store.use(localAdapter);return f.db.list("users/"+u.uid+"/days")}).then(function(L){return f.db.remove(L.map(function(d){return "users/"+u.uid+"/days/"+d.id}).concat(["users/"+u.uid+"/data/cfg","users/"+u.uid+"/data/refl"]))}).then(function(){leaving=true;return f.auth.deleteUser()}).then(function(){stop();storeHold=true;try{localStorage.removeItem("pc-cache-u-"+u.uid)}catch(x){}setAcct(null);reloadApp("Your account and its data were deleted.")},function(e){leaving=false;if(user&&user.uid===u.uid&&!unsub.length){startP=null;var uu=user;user=null;start(uu)}throw e})},
      syncNow:function(){if(!user)return;Object.keys(S.days).forEach(function(k){if(!stampOf("days/"+k))queue["days/"+k]=true});flushQueue();return Promise.resolve().then(merge).then(function(){if(user&&!unsub.length)listen()},function(e){setStatus("error",String(e&&e.message||e))})}
    }})();
  /* store.adopt(id, obj, u): take a remote document as-is (null = removed) without flagging it as a local change. */
  store.adopt=function(id,obj,u){if(id==="cfg"){S.cfg=obj}else if(id==="refl"){S.refl=obj||{}}else if(id.indexOf("days/")===0){var k=id.slice(5);if(obj)S.days[k]=obj;else delete S.days[k]}S.meta=S.meta||{u:{}};S.meta.u=S.meta.u||{};if(obj){S.meta.u[id]=u;if(S.meta.del)delete S.meta.del[id]}else{delete S.meta.u[id];(S.meta.del=S.meta.del||{})[id]=u}store.markClean(id,obj);lockReset();qSig=""};
  cloud.on(function(){if(typeof setTab!=="undefined"&&setTab==="account"&&typeof renderSettings==="function"&&document.querySelector("[data-view='settings']:not([hidden])"))renderSettings()});
  cloud.boot();
