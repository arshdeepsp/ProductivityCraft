  /* ---- account and cloud sync (Firebase: email/password auth + Firestore) ----
     Nothing here runs until someone signs in. cloud.boot() on startup: if pc-account says a user was signed in on this
     device, the SDK (vendor/firebase.js, built from src/firebase/fb.js) is imported and auth restores the session.
     Data layout: users/<uid>/cfg, users/<uid>/refl, users/<uid>/days/<date>. Every document carries u (ms, the store's
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
    function docPath(id){return id==="cfg"||id==="refl"?base()+"/"+id:base()+"/"+id}
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
    function merge(){setStatus("syncing");return Promise.all([fb.db.get(base()+"/cfg"),fb.db.get(base()+"/refl"),fb.db.list(base()+"/days")]).then(function(r){var seen={cfg:1,refl:1},ch=false;
      if(takeRemote("cfg",r[0].data))ch=true;else if(S.cfg&&!r[0].data)queue.cfg=true;
      if(takeRemote("refl",r[1].data))ch=true;else if(!r[1].data&&Object.keys(S.refl||{}).length)queue.refl=true;
      r[2].forEach(function(s){var id="days/"+s.id;seen[id]=1;if(takeRemote(id,s.data))ch=true});
      Object.keys(S.days).forEach(function(k){var id="days/"+k;if(!seen[id])queue[id]=true});
      Object.keys((S.meta&&S.meta.del)||{}).forEach(function(id){if(!seen[id])queue[id]=true});
      if(ch){cache();qSig="";render()}flushQueue();if(!Object.keys(queue).length&&!pushing)setStatus("on")})}
    function listen(){unsub.push(fb.db.onDoc(base()+"/cfg",function(s,e){if(e){setStatus("error",String(e.message||e));return}if(!s||s.pending)return;if(takeRemote("cfg",s.data)){cache();qSig="";render()}flushQueue()}));
      unsub.push(fb.db.onDoc(base()+"/refl",function(s,e){if(e||!s||s.pending)return;if(takeRemote("refl",s.data)){cache();render()}flushQueue()}));
      unsub.push(fb.db.onCol(base()+"/days",function(ch,e){if(e||!ch)return;var any=false;ch.forEach(function(s){if(s.pending)return;if(takeRemote("days/"+s.id,s.data))any=true});if(any){cache();qSig="";render()}flushQueue()}))}
    /* start() is reached twice on a sign-in when boot's auth listener is live (the SDK notifies it before the sign-in promise resolves): the same uid reuses the first run. Listeners attach only once the first merge has gone through (syncNow attaches them after a later successful one). */
    function start(u){if(user&&user.uid===u.uid&&startP)return startP;user=u;setAcct({uid:u.uid,email:u.email});store.use(cloudAdapter);setStatus("syncing");startP=merge().then(function(){if(user&&!unsub.length)listen()},function(e){setStatus("error",String(e&&e.message||e))});return startP}
    function stop(){unsub.forEach(function(f){try{f()}catch(x){}});unsub=[];user=null;startP=null;queue={};store.use(localAdapter);setStatus("off")}
    return{
      state:state,on:function(f){listeners.push(f)},user:function(){return user},account:acct,
      boot:function(){if(!acct())return;setStatus("connecting");lib().then(function(f){f.auth.onAuth(function(u){if(u){if(!user||user.uid!==u.uid){if(user)stop();start(u)}}else{if(user)stop();setAcct(null);setStatus("off")}})},function(e){setStatus("error","Couldn’t load the sync library: "+String(e&&e.message||e))})},
      signIn:function(email,pw){return lib().then(function(f){return f.auth.signIn(email,pw)}).then(function(u){return start(u).then(function(){return u})})},
      signUp:function(email,pw){return lib().then(function(f){return f.auth.signUp(email,pw)}).then(function(u){return start(u).then(function(){return u})})},
      reset:function(email){return lib().then(function(f){return f.auth.reset(email)})},
      signOut:function(){var f=fb;stop();setAcct(null);return f?f.auth.signOut():Promise.resolve()},
      syncNow:function(){if(!user)return;Object.keys(S.days).forEach(function(k){if(!stampOf("days/"+k))queue["days/"+k]=true});flushQueue();return merge().then(function(){if(user&&!unsub.length)listen()},function(e){setStatus("error",String(e&&e.message||e))})}
    }})();
  /* store.adopt(id, obj, u): take a remote document as-is (null = removed) without flagging it as a local change. */
  store.adopt=function(id,obj,u){if(id==="cfg"){S.cfg=obj}else if(id==="refl"){S.refl=obj||{}}else if(id.indexOf("days/")===0){var k=id.slice(5);if(obj)S.days[k]=obj;else delete S.days[k]}S.meta=S.meta||{u:{}};S.meta.u=S.meta.u||{};if(obj){S.meta.u[id]=u;if(S.meta.del)delete S.meta.del[id]}else{delete S.meta.u[id];(S.meta.del=S.meta.del||{})[id]=u}store.markClean(id,obj);lockReset();qSig=""};
  cloud.on(function(){if(typeof setTab!=="undefined"&&setTab==="account"&&typeof renderSettings==="function"&&document.querySelector("[data-view='settings']:not([hidden])"))renderSettings()});
  cloud.boot();
