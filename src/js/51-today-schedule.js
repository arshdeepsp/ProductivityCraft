  /* ---- today's schedule ----
     Places today's time quests on Your day. Stored on the day entry as e.sched = [{id, q, f, t, j5}]: one entry per
     block ("shot"), so a quest can be split into several. f/t are minutes from that day's midnight (dayWin scale).
     j5 = "5-min start": fixed length, its notification starts Just 5; otherwise a resizable range whose notification
     starts the normal timer. Planning only: hasEntry ignores it, so it never affects clearing or streaks.
     Busy blocks ({id, lb, f, t}) have a name instead of a quest: Auto-plan avoids them, they never notify.
     Weekly repeats live in cfg.rep = [{id, q|lb, f, t, j5?, dows, from, until}]; schAll merges them into each day as
     {id:"r-"+rep, rep, ...}. Editing one occurrence detaches it (a one-off copy + e.schSkip), with "Every week" to push
     the change back to the series. */
  var SCH_STEP=15,SCH_ROW=22,REP_MAX=26,schSel=null,schQ=null,schMsg="",schBody=null,schDrag=null,schDet=null,schRep=null,schBusy=false;
  function schQuests(k){return activeDefs(k).filter(function(q){return q.type==="time"&&!q.off})}
  function schLen(q){var m=q.roll?q.roll/weekWorkDays(q):q.min;return Math.max(SCH_STEP,Math.ceil(m/5)*5)}
  function schNorm(s){if(Array.isArray(s))return s;var out=[];if(s&&typeof s==="object")Object.keys(s).sort().forEach(function(id){var b=s[id];if(b&&b.f!=null)out.push(Object.assign({id:"b-"+id,q:id},b))});return out}
  function schReps(){return cfg().rep||[]}
  function repById(id){return schReps().filter(function(r){return r.id===id})[0]}
  function repOn(r,k){return k>=r.from&&k<=r.until&&r.dows.indexOf(parse(k).getDay())>=0}
  function repText(r){var d=r.dows.slice().sort(function(a,b){return ((a+6)%7)-((b+6)%7)}),w=d.length===7?"Every day":d.join()==="1,2,3,4,5"?"Weekdays":d.map(function(x){return DN[x]}).join(", ");return w+" until "+fmtD(r.until)}
  function schAll(k){var e=S.days[k]||{},sk=e.schSkip||[],out=schNorm(e.sched).slice(),Q=null;
    schReps().forEach(function(r){if(!repOn(r,k)||sk.indexOf(r.id)>=0)return;if(r.q){Q=Q||schQuests(k);if(!Q.some(function(q){return q.id===r.q}))return}var b={id:"r-"+r.id,rep:r.id,f:r.f,t:r.t};if(r.q)b.q=r.q;if(r.lb)b.lb=r.lb;if(r.j5)b.j5=true;out.push(b)});
    return out.sort(function(a,b){return a.f-b.f})}
  function schOfQ(k,qid){return schAll(k).filter(function(b){return b.q===qid})}
  function schPlaced(k,qid){return schOfQ(k,qid).reduce(function(a,b){return a+(b.t-b.f)},0)}
  function hhmmOf(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
  function schText(b){return b.j5?"5-min start "+hhmmOf(b.f):hhmmOf(b.f)+"–"+hhmmOf(b.t)}
  function schFloor(){return Math.floor(nowMinInDay()/SCH_STEP)*SCH_STEP}
  function schClash(L,id,f,t){var hit=null;L.forEach(function(b){if(b.id!==id&&b.f<t&&f<b.t)hit=b});return hit}
  function schNext(L,id,f,cap){var n=cap;L.forEach(function(b){if(b.id!==id&&b.f>=f&&b.f<n)n=b.f});return n}
  function schLabel(qid){var q=schQuests(todayKey()).filter(function(x){return x.id===qid})[0];return q?q.label:"another quest"}
  function schName(b){return b?(b.lb||schLabel(b.q)):"another block"}
  function schNewId(){return "b"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)}
  function schSave(fn){if(locked())return false;var e=entry(),L=schNorm(e.sched).map(function(b){return Object.assign({},b)});L=fn(L,e)||L;L.sort(function(a,b){return a.f-b.f});if(L.length)e.sched=L;else delete e.sched;if(e.schSkip&&!e.schSkip.length)delete e.schSkip;commit();return true}
  /* Change one block. A repeat occurrence is first detached into a one-off for today (schDet offers "Every week"). */
  function schEdit(id,fn,offer){var b=schAll(todayKey()).filter(function(x){return x.id===id})[0],out=id;if(!b)return id;
    schSave(function(L,e){var x=L.filter(function(z){return z.id===id})[0];if(!x&&b.rep){x={id:schNewId(),f:b.f,t:b.t};if(b.q)x.q=b.q;if(b.lb)x.lb=b.lb;if(b.j5)x.j5=true;L.push(x);e.schSkip=(e.schSkip||[]).concat([b.rep]);out=x.id;schDet=offer?{rep:b.rep,id:x.id}:null}if(x)fn(x,L)});return out}
  function schAddBusy(lb,m){var T=todayKey(),w=dayWin(T),L=schAll(T),f=m,t=Math.min(w.e,f+60);lb=(lb||"").trim().slice(0,30);if(!lb){schMsg="Give it a name.";return false}
    var nx=schNext(L,null,f,w.e);if(nx<t)t=nx;var c=schClash(L,null,f,t);if(c||t-f<SCH_STEP){schMsg="That overlaps "+schName(c)+". Pick a free time.";return false}
    var id=schNewId();schSave(function(S2){S2.push({id:id,lb:lb,f:f,t:t})});schMsg="";schSel=id;schPick=null;schBusy=false;return true}
  function schBusyRecent(){var out=[],T=todayKey();function a(x){if(x&&out.indexOf(x)<0)out.push(x)}schReps().forEach(function(r){a(r.lb)});for(var i=0;i<21;i++)schNorm((S.days[add(T,-i)]||{}).sched).forEach(function(b){a(b.lb)});["Class","Work","Meal","Commute"].forEach(function(x){if(out.length<4)a(x)});return out.slice(0,6)}
  function schRepDays(b){var q=b.q?schQuests(todayKey()).filter(function(x){return x.id===b.q})[0]:null;return q&&q.days&&q.days.length?q.days:[0,1,2,3,4,5,6]}
  function schRepCount(b,dows,weeks){var T=todayKey(),u=add(T,weeks*7-1),ok=schRepDays(b),n=0;for(var d=T;d<=u;d=add(d,1)){var w=parse(d).getDay();if(dows.indexOf(w)>=0&&ok.indexOf(w)>=0)n++}return n}
  function schRepSave(id,dows,weeks){var T=todayKey(),b=schAll(T).filter(function(x){return x.id===id})[0];if(!b||!dows.length||locked())return;var u=add(T,weeks*7-1),c2=clone(cfg()),R=c2.rep=(c2.rep||[]).filter(function(r){return r.until>=T}),rid=b.rep;
    if(rid){R.forEach(function(r){if(r.id===rid){r.dows=dows.slice();r.until=u}})}
    else{rid="r"+schNewId();var r={id:rid,f:b.f,t:b.t,dows:dows.slice(),from:T,until:u};if(b.q)r.q=b.q;if(b.lb)r.lb=b.lb;if(b.j5)r.j5=true;R.push(r)}
    saveCfg(c2);var today=dows.indexOf(parse(T).getDay())>=0;
    if(!b.rep&&today)schSave(function(L){return L.filter(function(x){return x.id!==id})});
    schSel=b.rep||today?"r-"+rid:id;schRep=null;schDet=null;schMsg="Repeats "+repText(repById(rid))+".";nfSig="";notifSync()}
  function schRepStop(rid){var c2=clone(cfg());c2.rep=(c2.rep||[]).filter(function(r){return r.id!==rid});if(!c2.rep.length)delete c2.rep;saveCfg(c2);schSave(function(L,e){if(e.schSkip)e.schSkip=e.schSkip.filter(function(x){return x!==rid})});schSel=null;schDet=null;schMsg="Stopped repeating.";nfSig="";notifSync()}
  function schRepEvery(){var d=schDet;if(!d)return;var b=schAll(todayKey()).filter(function(x){return x.id===d.id})[0];if(!b)return;var c2=clone(cfg());(c2.rep||[]).forEach(function(r){if(r.id!==d.rep)return;r.f=b.f;r.t=b.t;if(b.j5)r.j5=true;else delete r.j5});saveCfg(c2);
    schSave(function(L,e){if(e.schSkip)e.schSkip=e.schSkip.filter(function(x){return x!==d.rep});return L.filter(function(x){return x.id!==d.id})});schSel="r-"+d.rep;schDet=null;schMsg="Changed every week.";nfSig="";notifSync()}
  function schAdd(qid,m){var T=todayKey(),w=dayWin(T),q=schQuests(T).filter(function(x){return x.id===qid})[0];if(!q)return;
    var L=schAll(T),left=schLen(q)-schPlaced(T,qid),len=left>=SCH_STEP?left:SCH_STEP*2,f=m,t=Math.min(w.e,f+len);
    if(f<schFloor()){schMsg="That time has already passed.";return}
    if(t-f<SCH_STEP){schMsg="That’s too close to bedtime.";return}
    var nx=schNext(L,null,f,w.e);if(nx<t)t=nx;
    var c=schClash(L,null,f,t);if(c||t-f<SCH_STEP){schMsg="That overlaps "+schName(c)+". Pick a free time.";return}
    var id=schNewId();schSave(function(S2){S2.push({id:id,q:qid,f:f,t:t})});schMsg=t-f<len?"Placed "+hm(t-f)+" before the next block. Add another shot for the rest.":"";schSel=null;schQ=null}
  function schMove(id,m){var T=todayKey(),w=dayWin(T),L=schAll(T),b=L.filter(function(x){return x.id===id})[0];if(!b)return;var len=b.t-b.f,f=m,t=Math.min(w.e,f+len);
    if(f<schFloor()&&!b.lb){schMsg="That time has already passed.";return}
    if(t-f<SCH_STEP){schMsg="That’s too close to bedtime.";return}
    var c=schClash(L,id,f,t);if(c){schMsg="That overlaps "+schName(c)+". Pick a free time, or shorten it first.";return}
    var nid=schEdit(id,function(x){x.f=f;x.t=t},true);schMsg="";schSel=b.rep?nid:null}
  function schMode(id,j5){var T=todayKey(),w=dayWin(T),L=schAll(T),b=L.filter(function(x){return x.id===id})[0];if(!b||!!b.j5===j5)return;
    schSel=schEdit(id,function(x){if(j5)x.j5=true;else delete x.j5},true)}
  function schRemove(id){var b=schAll(todayKey()).filter(function(x){return x.id===id})[0];schSave(function(S2,e){if(b&&b.rep)e.schSkip=(e.schSkip||[]).concat([b.rep]);return S2.filter(function(x){return x.id!==id})});schSel=null;schDet=null;if(b&&b.rep)schMsg="Skipped today. It still repeats."}
  function schSplit(id){var T=todayKey(),L=schAll(T),b=L.filter(function(x){return x.id===id})[0];if(!b)return;var len=b.t-b.f;if(len<SCH_STEP*2){schMsg="Too short to split.";return}
    var half=Math.floor(len/2/SCH_STEP)*SCH_STEP,nid=schNewId();schEdit(id,function(x,S2){x.t=x.f+half;S2.push({id:nid,q:b.q,f:b.f+half,t:b.t})});schDet=null;schSel=nid;schMsg="Split in two. Tap a free time to move the selected half."}
  /* Full-screen page (#schPage): header, quest chips, the timeline as the only scroller, and a bottom bar that is
     either help + Auto-plan, a quest picker for a tapped free time (schPick), or controls for a selected block (schSel). */
  var schPick=null,schPg=null,schAdj=false;
  function dayOvSave(w,b){var er=winErr(w,b,true);if(er){setSync(er);return false}var c2=clone(cfg());c2.dayOv={date:todayKey(),wake:w,bed:b};saveCfg(c2);nfSig="";qSig="";render();setSync("Today: "+w+" to "+b);return true}
  function dayOvClear(){var c2=clone(cfg());delete c2.dayOv;saveCfg(c2);nfSig="";qSig="";render();setSync("Today uses your usual hours")}
  function schOpen(){return !!schPg&&!schPg.hidden}
  function openSchedule(){if(locked())return;schSel=null;schQ=null;schPick=null;schAdj=false;schMsg="";schDet=null;schRep=null;schBusy=false;
    if(!schPg){schPg=document.createElement("div");schPg.id="schPage";schPg.className="schpage";schPg.setAttribute("role","dialog");schPg.setAttribute("aria-modal","true");schPg.setAttribute("aria-labelledby","schTitle");
      schPg.innerHTML='<div class="sch-hd"><div class="sch-hdt"><h2 id="schTitle">Today’s schedule</h2><p class="sch-sum"><span id="schSum"></span> <button type="button" class="lnk sch-adjb" id="schAdjB" aria-expanded="false">Adjust today</button></p></div><button type="button" class="stone save" id="schOk">Done</button></div><div class="sch-adj" id="schAdj" hidden></div><div class="sch-tray" id="schTray"></div><div class="sch-scroll" id="schScroll"><div class="sch-tl" id="schTl"></div></div><div class="sch-ft" id="schFt"></div>';
      document.body.appendChild(schPg);schPg.querySelector("#schOk").addEventListener("click",closeSchedule);schPg.querySelector("#schAdjB").addEventListener("click",function(){schAdj=!schAdj;schDraw()});schWire()}
    schPg.hidden=false;document.body.classList.add("sch-open");schBody=schPg;schDraw(true)}
  function closeSchedule(){if(!schPg)return;schPg.hidden=true;document.body.classList.remove("sch-open");schBody=null;schDrag=null;schSel=null;schPick=null;render()}
  function schGeo(){var w=dayWin(todayKey()),s0=Math.floor(w.s/SCH_STEP)*SCH_STEP,e0=Math.ceil(w.e/SCH_STEP)*SCH_STEP;return{w:w,s0:s0,e0:e0,px:function(m){return (m-s0)/SCH_STEP*SCH_ROW}}}
  function schAt(clientY){var tl=schPg.querySelector("#schTl"),g=schGeo(),r=tl.getBoundingClientRect();return Math.min(g.e0-SCH_STEP,Math.max(g.s0,g.s0+Math.floor((clientY-r.top)/SCH_ROW)*SCH_STEP))}
  function schLeft(T,q){return schLen(q)-schPlaced(T,q.id)}
  function schFree(L,from,to,pad,minLen){var gaps=[],c=from;pad=pad||0;L.slice().sort(function(a,b){return a.f-b.f}).forEach(function(b){var bf=b.f-pad,bt=b.t+pad;if(bt<=c)return;if(bf>c)gaps.push([c,Math.min(bf,to)]);c=Math.max(c,bt)});if(c<to)gaps.push([c,to]);return gaps.filter(function(g){return g[1]-g[0]>=(minLen||SCH_STEP)})}
  function schAuto(){var T=todayKey(),w=dayWin(T),Q=schQuests(T),e=S.days[T]||{},from=Math.max(schFloor(),Math.floor(w.s/SCH_STEP)*SCH_STEP),n=0;/* each new shot keeps a 15-minute break from its neighbours and is at least 30m (or whatever is left) */
    var RP=schAll(T).filter(function(b){return b.rep});
    schSave(function(L){Q.forEach(function(q){if(metQ(q,e))return;var left=schLen(q)-L.concat(RP).filter(function(b){return b.q===q.id}).reduce(function(a,b){return a+b.t-b.f},0);
      while(left>=SCH_STEP){var g=schFree(L.concat(RP),from,w.e,SCH_STEP,Math.min(left,SCH_STEP*2))[0];if(!g)break;var len=Math.min(left,g[1]-g[0]);len=Math.max(SCH_STEP,Math.floor(len/5)*5);L.push({id:schNewId(),q:q.id,f:g[0],t:g[0]+len});n++;left-=len}})});
    schMsg=n?"Planned "+n+" shot"+(n===1?"":"s")+" with 15-minute breaks. Drag or tap to adjust.":"Nothing left to plan, or no free time left today."}
  function schWire(){var sc=schPg.querySelector("#schScroll"),tl=schPg.querySelector("#schTl"),lp=null;
    tl.addEventListener("click",function(ev){if(schDrag)return;var bk=ev.target.closest("[data-sb]");if(bk){var id=bk.getAttribute("data-sb");schSel=schSel===id?null:id;schPick=null;schRep=null;schBusy=false;schDet=null;schMsg="";schDraw();return}
      var m=schAt(ev.clientY);if(schRep){schRep=null;schDraw();return}if(schSel){schMove(schSel,m);schDraw();return}schBusy=false;
      if(m<schFloor()){if(schClash(schAll(todayKey()),null,m,m+1)){schDraw();return}schPick=schPick===m?null:m;schBusy=schPick!=null;schMsg=schPick!=null?"That time has passed, so only busy time fits there.":"";schDraw();return}
      if(schClash(schAll(todayKey()),null,m,m+1)){schDraw();return}
      schPick=schPick===m?null:m;schMsg="";schDraw()});
    tl.addEventListener("pointerdown",function(ev){var hd=ev.target.closest("[data-sh]");if(hd){schResize(ev,hd);return}var bk=ev.target.closest("[data-sb]");if(!bk||ev.pointerType!=="mouse")return;var y0=ev.clientY;function mv(e2){if(Math.abs(e2.clientY-y0)>4){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);schMoveDrag(bk,y0,"mouse")}}function up(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up)}document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up)});
    tl.addEventListener("touchstart",function(ev){if(ev.target.closest("[data-sh]"))return;var bk=ev.target.closest("[data-sb]");if(!bk||ev.touches.length!==1)return;var y0=ev.touches[0].clientY;clearTimeout(lp);lp=setTimeout(function(){lp=null;haptic("medium");schMoveDrag(bk,y0,"touch")},350);
      function cancel(e2){if(e2.type==="touchmove"&&Math.abs(e2.touches[0].clientY-y0)<8)return;clearTimeout(lp);tl.removeEventListener("touchmove",cancel);tl.removeEventListener("touchend",cancel)}tl.addEventListener("touchmove",cancel,{passive:true});tl.addEventListener("touchend",cancel,{passive:true})},{passive:true});
  }
  /* Edge auto-scroll for drags: while the finger/mouse sits within SCH_EDGE px of the timeline's top or bottom (or past
     it, e.g. over the footer), the timeline keeps scrolling on its own, faster the deeper you go. tick(y) is re-run every
     frame with the last pointer position, so the dragged block stays under the finger while the day scrolls. */
  var SCH_EDGE=64;
  function schAutoScroll(sc,tick){var y=null,raf=0;function step(){raf=0;if(y==null)return;var r=sc.getBoundingClientRect(),v=0;if(y<r.top+SCH_EDGE)v=-Math.min(24,Math.ceil((r.top+SCH_EDGE-y)/4));else if(y>r.bottom-SCH_EDGE)v=Math.min(24,Math.ceil((y-(r.bottom-SCH_EDGE))/4));if(v){var b0=sc.scrollTop;sc.scrollTop=b0+v;if(sc.scrollTop!==b0)tick(y)}if(v)raf=requestAnimationFrame(step)}
    return{at:function(ny){y=ny;tick(y);if(!raf)raf=requestAnimationFrame(step)},stop:function(){y=null;if(raf)cancelAnimationFrame(raf);raf=0}}}
  function schMoveDrag(bk,y0,kind){var T=todayKey(),g=schGeo(),id=bk.getAttribute("data-sb"),L=schAll(T),bl=L.filter(function(x){return x.id===id})[0];if(!bl)return;var len=bl.t-bl.f,f=bl.f,sc=schPg.querySelector("#schScroll"),tl=schPg.querySelector("#schTl"),grab=y0-bk.getBoundingClientRect().top;schDrag={id:id};bk.classList.add("lift");
    function show(y){var r=tl.getBoundingClientRect(),nf=g.s0+Math.round((y-grab-r.top)/SCH_ROW)*SCH_STEP;nf=Math.max(g.s0,Math.min(g.w.e-len,nf));f=nf;bk.style.top=g.px(nf)+"px";bk.querySelector("span").textContent=hhmmOf(nf)+"–"+hhmmOf(nf+len);bk.classList.toggle("bad",(nf<schFloor()&&!bl.lb)||!!schClash(L,id,nf,nf+len))}
    var as=schAutoScroll(sc,show);
    function done(){as.stop();bk.classList.remove("lift");var ok=f!==bl.f&&(f>=schFloor()||!!bl.lb)&&!schClash(L,id,f,f+len),sid=id;if(ok)sid=schEdit(id,function(x){x.f=f;x.t=f+len},true);else if(f!==bl.f)schMsg="Can’t drop it there: it overlaps another block or the time has passed.";schSel=sid;schPick=null;setTimeout(function(){schDrag=null;schDraw()},0)}
    if(kind==="mouse"){var mv=function(e){as.at(e.clientY)},up=function(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);done()};document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up)}
    else{var tm=function(e){e.preventDefault();as.at(e.touches[0].clientY)},te=function(){document.removeEventListener("touchmove",tm);document.removeEventListener("touchend",te);document.removeEventListener("touchcancel",te);done()};document.addEventListener("touchmove",tm,{passive:false});document.addEventListener("touchend",te);document.addEventListener("touchcancel",te)}}
  /* Resize: only from the corner grip of the selected block (the grip isn't drawn otherwise, so scrolling can't start it). */
  function schResize(ev,hd){ev.preventDefault();ev.stopPropagation();var T=todayKey(),g=schGeo(),id=hd.getAttribute("data-sh"),L=schAll(T),bl=L.filter(function(x){return x.id===id})[0],blk=hd.parentNode,cap=schNext(L,id,bl.f+1,g.w.e),t=bl.t,tl=schPg.querySelector("#schTl"),sc=schPg.querySelector("#schScroll"),grab=ev.clientY-blk.getBoundingClientRect().bottom;schDrag={id:id};try{hd.setPointerCapture(ev.pointerId)}catch(x){}
    function show(y){var r=tl.getBoundingClientRect();t=Math.max(bl.f+SCH_STEP,Math.min(cap,g.s0+Math.round((y-grab-r.top)/SCH_ROW)*SCH_STEP));blk.style.height=(g.px(t)-g.px(bl.f))+"px";blk.querySelector("span").textContent=hhmmOf(bl.f)+"–"+hhmmOf(t)}
    var as=schAutoScroll(sc,show);blk.classList.add("sizing");
    function mv(e2){as.at(e2.clientY)}
    function up(){as.stop();blk.classList.remove("sizing");hd.removeEventListener("pointermove",mv);hd.removeEventListener("pointerup",up);hd.removeEventListener("pointercancel",up);var sid=id;if(t!==bl.t)sid=schEdit(id,function(x){x.t=t},true);schSel=sid;schPick=null;setTimeout(function(){schDrag=null;schDraw()},0)}
    hd.addEventListener("pointermove",mv);hd.addEventListener("pointerup",up);hd.addEventListener("pointercancel",up)}
  function schDraw(first){if(!schOpen())return;var T=todayKey(),g=schGeo(),w=g.w,Q=schQuests(T),L=schAll(T).filter(function(x){return x.lb||Q.some(function(q){return q.id===x.q})}),e=S.days[T]||{},px=g.px,fl=schFloor(),now=nowMinInDay();
    var sum=schPg.querySelector("#schSum"),tray=schPg.querySelector("#schTray"),tl=schPg.querySelector("#schTl"),ft=schPg.querySelector("#schFt");
    if(schSel&&!L.some(function(x){return x.id===schSel}))schSel=null;if(schRep&&!L.some(function(x){return x.id===schRep.id}))schRep=null;if(schDet&&schDet.id!==schSel)schDet=null;
    var tot=0,bz=0,nq=0;L.forEach(function(x){if(x.lb)bz+=x.t-x.f;else tot+=x.t-x.f});Q.forEach(function(q){if(L.some(function(x){return x.q===q.id}))nq++});
    var adj=schPg.querySelector("#schAdj"),adjB=schPg.querySelector("#schAdjB");adj.hidden=!schAdj;adjB.setAttribute("aria-expanded",schAdj);adjB.textContent=schAdj?"Close":"Adjust today";
    if(schAdj){adj.innerHTML='<label>Wake up <input type="time" id="setWakeT" value="'+esc(w.wake)+'"></label><label>Bedtime <input type="time" id="setBedT" value="'+esc(w.bed)+'"></label>'+(w.today?'<button type="button" class="stone mini" id="setDayReset">Use usual</button>':'');
      ["setWakeT","setBedT"].forEach(function(id){adj.querySelector("#"+id).addEventListener("change",function(){if(dayOvSave(adj.querySelector("#setWakeT").value,adj.querySelector("#setBedT").value))schDraw();else schDraw()})});
      var ur=adj.querySelector("#setDayReset");if(ur)ur.addEventListener("click",function(){dayOvClear();schDraw()})}
    sum.textContent=w.wake+"–"+w.bed+(w.today?" (today only)":"")+" · "+nq+" of "+Q.length+" placed"+(tot?" · "+hm(tot)+" blocked":"")+(bz?" · "+hm(bz)+" busy":"");
    tray.innerHTML=Q.length?Q.map(function(q){var pl=schPlaced(T,q.id),n=L.filter(function(x){return x.q===q.id}).length,need=schLen(q);return '<span class="sch-q'+(pl>=need?' placed':pl?' part':'')+'" data-sq="'+q.id+'">'+esc(q.label)+' <small>'+(pl?hm(pl)+' / '+hm(need)+(n>1?' · '+n+' shots':''):hm(need))+'</small></span>'}).join(""):'<p class="help">No time quests today. Add one to schedule it.</p>';
    var h='';
    for(var m=g.s0;m<g.e0;m+=SCH_STEP)h+='<i class="sch-ln'+(m%60===0?' hr':'')+'" style="top:'+px(m)+'px"></i>'+(m%60===0?'<span class="sch-hr" style="top:'+px(m)+'px">'+hhmmOf(m)+'</span>':'');
    if(fl>g.s0)h+='<i class="sch-past" style="height:'+Math.min(px(g.e0),px(fl))+'px"></i>';
    if(now>=g.s0&&now<=g.e0)h+='<i class="sch-now" id="schNow" style="top:'+px(now)+'px"></i>';
    if(schPick!=null)h+='<i class="sch-ghost" style="top:'+px(schPick)+'px;height:'+SCH_ROW*2+'px"><span>'+hhmmOf(schPick)+'</span></i>';
    L.forEach(function(bl){var q=bl.lb?null:Q.filter(function(x){return x.id===bl.q})[0],met=q&&metQ(q,e),sh=q?L.filter(function(x){return x.q===bl.q}):[],ix=sh.indexOf(bl);
      h+='<div class="sch-b'+(bl.lb?' busy':'')+(bl.j5?' j5':'')+(bl.rep?' rep':'')+(schSel===bl.id?' on':'')+(met?' met':'')+(bl.t-bl.f<30?' sm':'')+'" data-sb="'+bl.id+'" style="top:'+px(bl.f)+'px;height:'+Math.max(SCH_ROW,px(bl.t)-px(bl.f))+'px"><b>'+(bl.rep?'↻ ':'')+(bl.j5?'▶ 5 · ':'')+esc(bl.lb||q.label)+(sh.length>1?' <em>'+(ix+1)+'/'+sh.length+'</em>':'')+'</b><span>'+hhmmOf(bl.f)+'–'+hhmmOf(bl.t)+(met?' ✔':'')+'</span>'+(bl.j5||schSel!==bl.id?'':'<i class="sch-h" data-sh="'+bl.id+'" role="slider" aria-label="Drag to change length"></i>')+'</div>'});
    tl.style.height=px(g.e0)+"px";tl.innerHTML=h;
    var sb=schSel?L.filter(function(x){return x.id===schSel})[0]:null,f2='';
    function nameOf(b){return b.lb||(Q.filter(function(q){return q.id===b.q})[0]||{}).label||""}
    if(schRep){var rb=L.filter(function(x){return x.id===schRep.id})[0],okd=schRepDays(rb),n=schRepCount(rb,schRep.dows,schRep.weeks),u=add(T,schRep.weeks*7-1);
      f2='<p class="sch-ft-h">Repeat <b>'+esc(nameOf(rb))+'</b> '+hhmmOf(rb.f)+'–'+hhmmOf(rb.t)+'</p><div class="sch-days" role="group" aria-label="Repeat on">'+[1,2,3,4,5,6,0].map(function(d){var on=schRep.dows.indexOf(d)>=0,ok=okd.indexOf(d)>=0;return '<button type="button" class="stone'+(on&&ok?' on':'')+'" data-rd="'+d+'" aria-pressed="'+(on&&ok)+'"'+(ok?'':' disabled title="'+esc(nameOf(rb))+' doesn’t run that day"')+'>'+DN[d].slice(0,2)+'</button>'}).join("")+'</div>'+
        '<div class="sch-wk"><span>For</span><button type="button" class="stone" id="schWkM" aria-label="Fewer weeks"'+(schRep.weeks<=1?' disabled':'')+'>−</button><b id="schWkN">'+schRep.weeks+' week'+(schRep.weeks===1?'':'s')+'</b><button type="button" class="stone" id="schWkP" aria-label="More weeks"'+(schRep.weeks>=REP_MAX?' disabled':'')+'>+</button></div>'+
        '<p class="help sch-help" id="schRepSum">'+(n?n+' time'+(n===1?'':'s')+', until '+fmtD(u):'Pick at least one day.')+'</p><div class="sch-acts"><button type="button" class="stone" id="schRepNo">Cancel</button><button type="button" class="stone save" id="schRepOk"'+(n?'':' disabled')+'>Save repeat</button></div>'}
    else if(sb){var rp=sb.rep?repById(sb.rep):null,det=schDet&&schDet.id===sb.id;
      f2='<p class="sch-ft-h"><b>'+esc(nameOf(sb))+'</b> '+hhmmOf(sb.f)+'–'+hhmmOf(sb.t)+(sb.lb?' <small class="sch-tag">Busy</small>':'')+'</p>'+(rp?'<p class="sch-rep">↻ '+esc(repText(rp))+'</p>':'')+
        '<p class="help sch-help">'+(det?'Changed for today only.':(sb.j5?'Its reminder starts a 5-minute timer. ':'Drag the corner tab to resize. ')+'Hold and drag to move, or tap a free time.')+'</p>'+
        (sb.q?'<div class="sch-row"><div class="sjpick" role="radiogroup" aria-label="How to start"><button type="button" class="stone mini'+(sb.j5?'':' on')+'" data-sm="range" role="radio" aria-checked="'+!sb.j5+'">Time range</button><button type="button" class="stone mini'+(sb.j5?' on':'')+'" data-sm="j5" role="radio" aria-checked="'+!!sb.j5+'">5-min start</button></div></div>':'')+
        '<div class="sch-acts">'+(det?'<button type="button" class="stone save" id="schEvery">Every week</button>':'')+
        (rp?'<button type="button" class="stone" id="schRepB">Edit repeat</button><button type="button" class="stone" id="schRm">Skip today</button><button type="button" class="stone del" id="schStop">Stop</button>'
          :'<button type="button" class="stone" id="schRepB">Repeat</button>'+(sb.q&&!sb.j5?'<button type="button" class="stone" id="schSplit">Split</button>':'')+'<button type="button" class="stone del" id="schRm">Remove</button>')+
        '<button type="button" class="stone sch-x" id="schDesel" aria-label="Deselect">✕</button></div>'}
    else if(schPick!=null&&schBusy){f2='<p class="sch-ft-h">Busy at <b>'+hhmmOf(schPick)+'</b></p><div class="sch-pick">'+schBusyRecent().map(function(x){return '<button type="button" class="stone" data-bz="'+esc(x)+'">'+esc(x)+'</button>'}).join("")+'</div><div class="sch-bzin"><input id="schBzIn" maxlength="30" placeholder="Or name it" aria-label="Busy block name"><button type="button" class="stone save" id="schBzAdd">Add</button></div><div class="sch-acts"><button type="button" class="stone" id="'+(schPick<fl?'schPkNo':'schBzBack')+'">'+(schPick<fl?'Cancel':'Back')+'</button></div>'}
    else if(schPick!=null){var open=Q.slice().sort(function(a,b){return (schLeft(T,b)>0)-(schLeft(T,a)>0)});
      f2='<p class="sch-ft-h">Add at <b>'+hhmmOf(schPick)+'</b></p><div class="sch-pick">'+open.map(function(q){var lf=schLeft(T,q);return '<button type="button" class="stone'+(lf>0?' save':'')+'" data-pk="'+q.id+'">'+esc(q.label)+' <small>'+(lf>0?hm(lf)+(schPlaced(T,q.id)?' left':''):'+30m extra')+'</small></button>'}).join("")+'</div><div class="sch-acts"><button type="button" class="stone" id="schBzB">Busy time…</button><button type="button" class="stone" id="schPkNo">Cancel</button></div>'}
    else f2='<p class="help sch-help">Tap a free time to add a quest or busy time. Tap a block to change or repeat it.</p><div class="sch-row"><button type="button" class="stone save" id="schAuto"'+(Q.some(function(q){return schLeft(T,q)>=SCH_STEP&&!metQ(q,e)})?'':' disabled')+'>Auto-plan the rest</button>'+(L.length?'<button type="button" class="stone del" id="schClr">Clear all</button>':'')+'</div>';
    ft.innerHTML=(schMsg?'<p class="cmsg2" id="schMsg">'+esc(schMsg)+'</p>':'')+f2;
    function on(id,fn){var x=ft.querySelector("#"+id);if(x)x.addEventListener("click",fn)}
    ft.querySelectorAll("[data-sm]").forEach(function(x){x.addEventListener("click",function(){schMode(schSel,x.getAttribute("data-sm")==="j5");schDraw()})});
    ft.querySelectorAll("[data-pk]").forEach(function(x){x.addEventListener("click",function(){var m2=schPick;schPick=null;schAdd(x.getAttribute("data-pk"),m2);schDraw()})});
    ft.querySelectorAll("[data-bz]").forEach(function(x){x.addEventListener("click",function(){schAddBusy(x.getAttribute("data-bz"),schPick);schDraw()})});
    ft.querySelectorAll("[data-rd]").forEach(function(x){x.addEventListener("click",function(){var d=+x.getAttribute("data-rd"),k=schRep.dows.indexOf(d);if(k>=0)schRep.dows.splice(k,1);else schRep.dows.push(d);haptic("light");schDraw()})});
    on("schWkM",function(){schRep.weeks=Math.max(1,schRep.weeks-1);schDraw()});on("schWkP",function(){schRep.weeks=Math.min(REP_MAX,schRep.weeks+1);schDraw()});
    on("schRepNo",function(){schRep=null;schDraw()});on("schRepOk",function(){schRepSave(schRep.id,schRep.dows,schRep.weeks);schDraw()});
    on("schRepB",function(){var b=L.filter(function(x){return x.id===schSel})[0],r=b&&b.rep?repById(b.rep):null;schRep={id:schSel,dows:r?r.dows.slice():[parse(T).getDay()].filter(function(d){return schRepDays(b).indexOf(d)>=0}),weeks:r?Math.max(1,Math.min(REP_MAX,Math.ceil((daysBetween(T,r.until)+1)/7))):4};schMsg="";schDraw()});
    on("schEvery",function(){schRepEvery();schDraw()});on("schStop",function(){var b=L.filter(function(x){return x.id===schSel})[0];if(b&&b.rep)schRepStop(b.rep);schDraw()});
    on("schPkNo",function(){schPick=null;schBusy=false;schMsg="";schDraw()});on("schBzB",function(){schBusy=true;schMsg="";schDraw()});on("schBzBack",function(){schBusy=false;schDraw()});
    on("schBzAdd",function(){schAddBusy(ft.querySelector("#schBzIn").value,schPick);schDraw()});var bzi=ft.querySelector("#schBzIn");if(bzi)bzi.addEventListener("keydown",function(ev){if(ev.key==="Enter"){schAddBusy(bzi.value,schPick);schDraw()}});
    on("schSplit",function(){schSplit(schSel);schDraw()});on("schRm",function(){schRemove(schSel);schDraw()});on("schDesel",function(){schSel=null;schDet=null;schMsg="";schDraw()});
    on("schAuto",function(){schAuto();schDraw()});
    var cl=ft.querySelector("#schClr"),arm=null;if(cl)cl.addEventListener("click",function(){if(!arm){cl.textContent="Confirm clear";arm=setTimeout(function(){arm=null;cl.textContent="Clear all"},4000);return}clearTimeout(arm);var rr=schAll(T).filter(function(b){return b.rep}).map(function(b){return b.rep});schSave(function(L2,e2){if(rr.length)e2.schSkip=(e2.schSkip||[]).concat(rr);return []});schSel=null;schMsg=rr.length?"Cleared today. Repeats continue next time.":"";schDraw()});
    if(first){var nw=tl.querySelector("#schNow"),sc=schPg.querySelector("#schScroll");sc.scrollTop=0;if(nw)sc.scrollTop=Math.max(0,nw.offsetTop-sc.clientHeight/3)}
  }
  function schRows(defs,k){defs.forEach(function(q){var el=qEls[q.id];if(!el||q.type!=="time")return;var L=schOfQ(k,q.id);if(!L.length)return;var txt=L.map(schText).join(", "),rq=el.row.querySelector(".req");if(rq&&rq.textContent.indexOf(txt)<0)rq.textContent+=" · "+txt})}
  function schNotifs(T,e,push){var Q=schQuests(T);schAll(T).forEach(function(bl,i){var q=Q.filter(function(x){return x.id===bl.q})[0];if(!q||metQ(q,e)||(S.timer&&S.timer.id===q.id))return;
      push(3500+i,(bl.j5?"5 minutes on ":"Time for ")+q.label,bl.j5?"Tap to start a 5-minute timer. Planned until "+hhmmOf(bl.t)+".":hhmmOf(bl.f)+"–"+hhmmOf(bl.t)+". Tap to start the timer.",atMin(T,bl.f),{sched:q.id,j5:!!bl.j5})})}
  function schTap(x){var q=schQuests(todayKey()).filter(function(z){return z.id===x.sched})[0];if(!q||locked()||(S.timer&&S.timer.id===q.id))return;go("today");if(x.j5)start5(q);else toggleTimer(q)}
