  /* ---- today's schedule ----
     Places today's time quests on Your day. Stored on the day entry as e.sched = [{id, q, f, t, j5}]: one entry per
     block ("shot"), so a quest can be split into several. f/t are minutes from that day's midnight (dayWin scale).
     j5 = "5-min start": fixed length, its notification starts Just 5; otherwise a resizable range whose notification
     starts the normal timer. Planning only: hasEntry ignores it, so it never affects clearing or streaks. */
  var SCH_STEP=15,SCH_ROW=22,schSel=null,schQ=null,schMsg="",schBody=null,schDrag=null;
  function schQuests(k){return activeDefs(k).filter(function(q){return q.type==="time"&&!q.off})}
  function schLen(q){var m=q.roll?q.roll/weekWorkDays(q):q.min;return Math.max(SCH_STEP,Math.ceil(m/5)*5)}
  function schNorm(s){if(Array.isArray(s))return s;var out=[];if(s&&typeof s==="object")Object.keys(s).sort().forEach(function(id){var b=s[id];if(b&&b.f!=null)out.push(Object.assign({id:"b-"+id,q:id},b))});return out}
  function schAll(k){return schNorm((S.days[k]||{}).sched).slice().sort(function(a,b){return a.f-b.f})}
  function schOfQ(k,qid){return schAll(k).filter(function(b){return b.q===qid})}
  function schPlaced(k,qid){return schOfQ(k,qid).reduce(function(a,b){return a+(b.t-b.f)},0)}
  function hhmmOf(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
  function schText(b){return b.j5?"5-min start "+hhmmOf(b.f):hhmmOf(b.f)+"–"+hhmmOf(b.t)}
  function schFloor(){return Math.floor(nowMinInDay()/SCH_STEP)*SCH_STEP}
  function schClash(L,id,f,t){var hit=null;L.forEach(function(b){if(b.id!==id&&b.f<t&&f<b.t)hit=b});return hit}
  function schNext(L,id,f,cap){var n=cap;L.forEach(function(b){if(b.id!==id&&b.f>=f&&b.f<n)n=b.f});return n}
  function schLabel(qid){var q=schQuests(todayKey()).filter(function(x){return x.id===qid})[0];return q?q.label:"another quest"}
  function schNewId(){return "b"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)}
  function schSave(fn){if(locked())return false;var e=entry(),L=schNorm(e.sched).map(function(b){return Object.assign({},b)});L=fn(L)||L;L.sort(function(a,b){return a.f-b.f});if(L.length)e.sched=L;else delete e.sched;commit();return true}
  function schAdd(qid,m){var T=todayKey(),w=dayWin(T),q=schQuests(T).filter(function(x){return x.id===qid})[0];if(!q)return;
    var L=schAll(T),left=schLen(q)-schPlaced(T,qid),len=left>=SCH_STEP?left:SCH_STEP*2,f=m,t=Math.min(w.e,f+len);
    if(f<schFloor()){schMsg="That time has already passed.";return}
    if(t-f<SCH_STEP){schMsg="That’s too close to bedtime.";return}
    var nx=schNext(L,null,f,w.e);if(nx<t)t=nx;
    var c=schClash(L,null,f,t);if(c||t-f<SCH_STEP){schMsg="That overlaps "+schLabel((c||{}).q)+". Pick a free time.";return}
    var id=schNewId();schSave(function(S2){S2.push({id:id,q:qid,f:f,t:t})});schMsg=t-f<len?"Placed "+hm(t-f)+" before the next block. Add another shot for the rest.":"";schSel=null;schQ=null}
  function schMove(id,m){var T=todayKey(),w=dayWin(T),L=schAll(T),b=L.filter(function(x){return x.id===id})[0];if(!b)return;var len=b.t-b.f,f=m,t=Math.min(w.e,f+len);
    if(f<schFloor()){schMsg="That time has already passed.";return}
    if(t-f<SCH_STEP){schMsg="That’s too close to bedtime.";return}
    var c=schClash(L,id,f,t);if(c){schMsg="That overlaps "+schLabel(c.q)+". Pick a free time, or shorten it first.";return}
    schSave(function(S2){S2.forEach(function(x){if(x.id===id){x.f=f;x.t=t}})});schMsg="";schSel=null}
  function schMode(id,j5){var T=todayKey(),w=dayWin(T),L=schAll(T),b=L.filter(function(x){return x.id===id})[0];if(!b||!!b.j5===j5)return;
    schSave(function(S2){S2.forEach(function(x){if(x.id!==id)return;if(j5)x.j5=true;else delete x.j5})})}
  function schRemove(id){schSave(function(S2){return S2.filter(function(x){return x.id!==id})});schSel=null}
  function schSplit(id){var T=todayKey(),L=schAll(T),b=L.filter(function(x){return x.id===id})[0];if(!b)return;var len=b.t-b.f;if(len<SCH_STEP*2){schMsg="Too short to split.";return}
    var half=Math.floor(len/2/SCH_STEP)*SCH_STEP,nid=schNewId();schSave(function(S2){S2.forEach(function(x){if(x.id===id)x.t=x.f+half});S2.push({id:nid,q:b.q,f:b.f+half,t:b.t})});schSel=nid;schMsg="Split in two. Tap a free time to move the selected half."}
  /* Full-screen page (#schPage): header, quest chips, the timeline as the only scroller, and a bottom bar that is
     either help + Auto-plan, a quest picker for a tapped free time (schPick), or controls for a selected block (schSel). */
  var schPick=null,schPg=null,schAdj=false;
  function dayOvSave(w,b){var er=winErr(w,b,true);if(er){setSync(er);return false}var c2=clone(cfg());c2.dayOv={date:todayKey(),wake:w,bed:b};saveCfg(c2);nfSig="";qSig="";render();setSync("Today: "+w+" to "+b);return true}
  function dayOvClear(){var c2=clone(cfg());delete c2.dayOv;saveCfg(c2);nfSig="";qSig="";render();setSync("Today uses your usual hours")}
  function schOpen(){return !!schPg&&!schPg.hidden}
  function openSchedule(){if(locked())return;schSel=null;schQ=null;schPick=null;schAdj=false;schMsg="";
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
    schSave(function(L){Q.forEach(function(q){if(metQ(q,e))return;var left=schLen(q)-L.filter(function(b){return b.q===q.id}).reduce(function(a,b){return a+b.t-b.f},0);
      while(left>=SCH_STEP){var g=schFree(L,from,w.e,SCH_STEP,Math.min(left,SCH_STEP*2))[0];if(!g)break;var len=Math.min(left,g[1]-g[0]);len=Math.max(SCH_STEP,Math.floor(len/5)*5);L.push({id:schNewId(),q:q.id,f:g[0],t:g[0]+len});n++;left-=len}})});
    schMsg=n?"Planned "+n+" shot"+(n===1?"":"s")+" with 15-minute breaks. Drag or tap to adjust.":"Nothing left to plan, or no free time left today."}
  function schWire(){var sc=schPg.querySelector("#schScroll"),tl=schPg.querySelector("#schTl"),lp=null;
    tl.addEventListener("click",function(ev){if(schDrag)return;var bk=ev.target.closest("[data-sb]");if(bk){var id=bk.getAttribute("data-sb");schSel=schSel===id?null:id;schPick=null;schMsg="";schDraw();return}
      var m=schAt(ev.clientY);if(schSel){schMove(schSel,m);schDraw();return}
      if(m<schFloor()){schMsg="That time has already passed.";schPick=null;schDraw();return}
      if(schClash(schAll(todayKey()),null,m,m+1)){schDraw();return}
      schPick=schPick===m?null:m;schMsg="";schDraw()});
    tl.addEventListener("pointerdown",function(ev){var hd=ev.target.closest("[data-sh]");if(hd){schResize(ev,hd);return}var bk=ev.target.closest("[data-sb]");if(!bk||ev.pointerType!=="mouse")return;var y0=ev.clientY;function mv(e2){if(Math.abs(e2.clientY-y0)>4){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);schMoveDrag(bk,y0,"mouse")}}function up(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up)}document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up)});
    tl.addEventListener("touchstart",function(ev){if(ev.target.closest("[data-sh]"))return;var bk=ev.target.closest("[data-sb]");if(!bk||ev.touches.length!==1)return;var y0=ev.touches[0].clientY;clearTimeout(lp);lp=setTimeout(function(){lp=null;haptic("medium");schMoveDrag(bk,y0,"touch")},350);
      function cancel(e2){if(e2.type==="touchmove"&&Math.abs(e2.touches[0].clientY-y0)<8)return;clearTimeout(lp);tl.removeEventListener("touchmove",cancel);tl.removeEventListener("touchend",cancel)}tl.addEventListener("touchmove",cancel,{passive:true});tl.addEventListener("touchend",cancel,{passive:true})},{passive:true});
  }
  function schMoveDrag(bk,y0,kind){var T=todayKey(),g=schGeo(),id=bk.getAttribute("data-sb"),L=schAll(T),bl=L.filter(function(x){return x.id===id})[0];if(!bl)return;var len=bl.t-bl.f,f=bl.f,sc=schPg.querySelector("#schScroll");schDrag={id:id};bk.classList.add("lift");
    function at(y){var nf=bl.f+Math.round((y-y0)/SCH_ROW)*SCH_STEP;nf=Math.max(g.s0,Math.min(g.w.e-len,nf));var r=sc.getBoundingClientRect();if(y<r.top+40)sc.scrollTop-=10;else if(y>r.bottom-40)sc.scrollTop+=10;return nf}
    function show(nf){f=nf;bk.style.top=g.px(nf)+"px";bk.querySelector("span").textContent=hhmmOf(nf)+"–"+hhmmOf(nf+len);bk.classList.toggle("bad",nf<schFloor()||!!schClash(L,id,nf,nf+len))}
    function done(){bk.classList.remove("lift");var ok=f!==bl.f&&f>=schFloor()&&!schClash(L,id,f,f+len);if(ok)schSave(function(S2){S2.forEach(function(x){if(x.id===id){x.f=f;x.t=f+len}})});else if(f!==bl.f)schMsg="Can’t drop it there: it overlaps another block or the time has passed.";schSel=id;schPick=null;setTimeout(function(){schDrag=null;schDraw()},0)}
    if(kind==="mouse"){var mv=function(e){show(at(e.clientY))},up=function(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);done()};document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up)}
    else{var tm=function(e){e.preventDefault();show(at(e.touches[0].clientY))},te=function(){document.removeEventListener("touchmove",tm);document.removeEventListener("touchend",te);document.removeEventListener("touchcancel",te);done()};document.addEventListener("touchmove",tm,{passive:false});document.addEventListener("touchend",te);document.addEventListener("touchcancel",te)}}
  function schResize(ev,hd){ev.preventDefault();ev.stopPropagation();var T=todayKey(),g=schGeo(),id=hd.getAttribute("data-sh"),L=schAll(T),bl=L.filter(function(x){return x.id===id})[0],blk=hd.parentNode,cap=schNext(L,id,bl.f+1,g.w.e),t=bl.t,tl=schPg.querySelector("#schTl");schDrag={id:id};try{hd.setPointerCapture(ev.pointerId)}catch(x){}
    function mv(e2){var r=tl.getBoundingClientRect();t=Math.max(bl.f+SCH_STEP,Math.min(cap,g.s0+Math.round((e2.clientY-r.top)/SCH_ROW)*SCH_STEP));blk.style.height=(g.px(t)-g.px(bl.f))+"px";blk.querySelector("span").textContent=hhmmOf(bl.f)+"–"+hhmmOf(t)}
    function up(){hd.removeEventListener("pointermove",mv);hd.removeEventListener("pointerup",up);hd.removeEventListener("pointercancel",up);if(t!==bl.t)schSave(function(S2){S2.forEach(function(x){if(x.id===id)x.t=t})});schSel=id;schPick=null;setTimeout(function(){schDrag=null;schDraw()},0)}
    hd.addEventListener("pointermove",mv);hd.addEventListener("pointerup",up);hd.addEventListener("pointercancel",up)}
  function schDraw(first){if(!schOpen())return;var T=todayKey(),g=schGeo(),w=g.w,Q=schQuests(T),L=schAll(T).filter(function(x){return Q.some(function(q){return q.id===x.q})}),e=S.days[T]||{},px=g.px,fl=schFloor(),now=nowMinInDay();
    var sum=schPg.querySelector("#schSum"),tray=schPg.querySelector("#schTray"),tl=schPg.querySelector("#schTl"),ft=schPg.querySelector("#schFt");
    if(schSel&&!L.some(function(x){return x.id===schSel}))schSel=null;
    var tot=0,nq=0;L.forEach(function(x){tot+=x.t-x.f});Q.forEach(function(q){if(L.some(function(x){return x.q===q.id}))nq++});
    var adj=schPg.querySelector("#schAdj"),adjB=schPg.querySelector("#schAdjB");adj.hidden=!schAdj;adjB.setAttribute("aria-expanded",schAdj);adjB.textContent=schAdj?"Close":"Adjust today";
    if(schAdj){adj.innerHTML='<label>Wake up <input type="time" id="setWakeT" value="'+esc(w.wake)+'"></label><label>Bedtime <input type="time" id="setBedT" value="'+esc(w.bed)+'"></label>'+(w.today?'<button type="button" class="stone mini" id="setDayReset">Use usual</button>':'');
      ["setWakeT","setBedT"].forEach(function(id){adj.querySelector("#"+id).addEventListener("change",function(){if(dayOvSave(adj.querySelector("#setWakeT").value,adj.querySelector("#setBedT").value))schDraw();else schDraw()})});
      var ur=adj.querySelector("#setDayReset");if(ur)ur.addEventListener("click",function(){dayOvClear();schDraw()})}
    sum.textContent=w.wake+"–"+w.bed+(w.today?" (today only)":"")+" · "+nq+" of "+Q.length+" placed"+(tot?" · "+hm(tot)+" blocked":"");
    tray.innerHTML=Q.length?Q.map(function(q){var pl=schPlaced(T,q.id),n=L.filter(function(x){return x.q===q.id}).length,need=schLen(q);return '<span class="sch-q'+(pl>=need?' placed':pl?' part':'')+'" data-sq="'+q.id+'">'+esc(q.label)+' <small>'+(pl?hm(pl)+' / '+hm(need)+(n>1?' · '+n+' shots':''):hm(need))+'</small></span>'}).join(""):'<p class="help">No time quests today. Add one to schedule it.</p>';
    var h='';
    for(var m=g.s0;m<g.e0;m+=SCH_STEP)h+='<i class="sch-ln'+(m%60===0?' hr':'')+'" style="top:'+px(m)+'px"></i>'+(m%60===0?'<span class="sch-hr" style="top:'+px(m)+'px">'+hhmmOf(m)+'</span>':'');
    if(fl>g.s0)h+='<i class="sch-past" style="height:'+Math.min(px(g.e0),px(fl))+'px"></i>';
    if(now>=g.s0&&now<=g.e0)h+='<i class="sch-now" id="schNow" style="top:'+px(now)+'px"></i>';
    if(schPick!=null)h+='<i class="sch-ghost" style="top:'+px(schPick)+'px;height:'+SCH_ROW*2+'px"><span>'+hhmmOf(schPick)+'</span></i>';
    L.forEach(function(bl){var q=Q.filter(function(x){return x.id===bl.q})[0],met=metQ(q,e),sh=L.filter(function(x){return x.q===bl.q}),ix=sh.indexOf(bl);
      h+='<div class="sch-b'+(bl.j5?' j5':'')+(schSel===bl.id?' on':'')+(met?' met':'')+(bl.t-bl.f<30?' sm':'')+'" data-sb="'+bl.id+'" style="top:'+px(bl.f)+'px;height:'+Math.max(SCH_ROW,px(bl.t)-px(bl.f))+'px"><b>'+(bl.j5?'▶ 5 · ':'')+esc(q.label)+(sh.length>1?' <em>'+(ix+1)+'/'+sh.length+'</em>':'')+'</b><span>'+hhmmOf(bl.f)+'–'+hhmmOf(bl.t)+(met?' ✔':'')+'</span>'+(bl.j5?'':'<i class="sch-h" data-sh="'+bl.id+'" aria-label="Drag to change length"></i>')+'</div>'});
    tl.style.height=px(g.e0)+"px";tl.innerHTML=h;
    var sb=schSel?L.filter(function(x){return x.id===schSel})[0]:null,f2='';
    if(sb){var sq=Q.filter(function(q){return q.id===sb.q})[0];
      f2='<p class="sch-ft-h"><b>'+esc(sq.label)+'</b> '+hhmmOf(sb.f)+'–'+hhmmOf(sb.t)+'</p><p class="help sch-help">'+(sb.j5?'Its reminder starts a 5-minute timer. ':'Drag the bottom edge to resize. ')+'Hold and drag to move, or tap a free time.</p><div class="sch-row"><div class="sjpick" role="radiogroup" aria-label="How to start"><button type="button" class="stone mini'+(sb.j5?'':' on')+'" data-sm="range" role="radio" aria-checked="'+!sb.j5+'">Time range</button><button type="button" class="stone mini'+(sb.j5?' on':'')+'" data-sm="j5" role="radio" aria-checked="'+!!sb.j5+'">5-min start</button></div><span class="sch-act"><button type="button" class="stone mini" id="schSplit">Split</button><button type="button" class="stone mini del" id="schRm">Remove</button><button type="button" class="stone mini" id="schDesel" aria-label="Deselect">✕</button></span></div>'}
    else if(schPick!=null){var open=Q.slice().sort(function(a,b){return (schLeft(T,b)>0)-(schLeft(T,a)>0)});
      f2='<p class="sch-ft-h">Add at <b>'+hhmmOf(schPick)+'</b></p><div class="sch-pick">'+open.map(function(q){var lf=schLeft(T,q);return '<button type="button" class="stone'+(lf>0?' save':'')+'" data-pk="'+q.id+'">'+esc(q.label)+' <small>'+(lf>0?hm(lf)+(schPlaced(T,q.id)?' left':''):'+30m extra')+'</small></button>'}).join("")+'<button type="button" class="stone" id="schPkNo">Cancel</button></div>'}
    else f2='<p class="help sch-help">'+(Q.length?'Tap a free time to add a quest. Tap a block to change it.':'')+'</p><div class="sch-row"><button type="button" class="stone save" id="schAuto"'+(Q.some(function(q){return schLeft(T,q)>=SCH_STEP&&!metQ(q,e)})?'':' disabled')+'>Auto-plan the rest</button>'+(L.length?'<button type="button" class="stone del" id="schClr">Clear all</button>':'')+'</div>';
    ft.innerHTML=(schMsg?'<p class="cmsg2" id="schMsg">'+esc(schMsg)+'</p>':'')+f2;
    ft.querySelectorAll("[data-sm]").forEach(function(x){x.addEventListener("click",function(){schMode(schSel,x.getAttribute("data-sm")==="j5");schDraw()})});
    ft.querySelectorAll("[data-pk]").forEach(function(x){x.addEventListener("click",function(){var m2=schPick;schPick=null;schAdd(x.getAttribute("data-pk"),m2);schDraw()})});
    var pn=ft.querySelector("#schPkNo");if(pn)pn.addEventListener("click",function(){schPick=null;schDraw()});
    var sp=ft.querySelector("#schSplit");if(sp)sp.addEventListener("click",function(){schSplit(schSel);schDraw()});
    var rm=ft.querySelector("#schRm");if(rm)rm.addEventListener("click",function(){schRemove(schSel);schDraw()});
    var ds=ft.querySelector("#schDesel");if(ds)ds.addEventListener("click",function(){schSel=null;schMsg="";schDraw()});
    var au=ft.querySelector("#schAuto");if(au)au.addEventListener("click",function(){schAuto();schDraw()});
    var cl=ft.querySelector("#schClr"),arm=null;if(cl)cl.addEventListener("click",function(){if(!arm){cl.textContent="Confirm clear";arm=setTimeout(function(){arm=null;cl.textContent="Clear all"},4000);return}clearTimeout(arm);schSave(function(){return []});schSel=null;schMsg="";schDraw()});
    if(first){var nw=tl.querySelector("#schNow"),sc=schPg.querySelector("#schScroll");sc.scrollTop=0;if(nw)sc.scrollTop=Math.max(0,nw.offsetTop-sc.clientHeight/3)}
  }
  function schRows(defs,k){defs.forEach(function(q){var el=qEls[q.id];if(!el||q.type!=="time")return;var L=schOfQ(k,q.id);if(!L.length)return;var txt=L.map(schText).join(", "),rq=el.row.querySelector(".req");if(rq&&rq.textContent.indexOf(txt)<0)rq.textContent+=" · "+txt})}
  function schNotifs(T,e,push){var Q=schQuests(T);schAll(T).forEach(function(bl,i){var q=Q.filter(function(x){return x.id===bl.q})[0];if(!q||metQ(q,e)||(S.timer&&S.timer.id===q.id))return;
      push(3500+i,(bl.j5?"5 minutes on ":"Time for ")+q.label,bl.j5?"Tap to start a 5-minute timer. Planned until "+hhmmOf(bl.t)+".":hhmmOf(bl.f)+"–"+hhmmOf(bl.t)+". Tap to start the timer.",atMin(T,bl.f),{sched:q.id,j5:!!bl.j5})})}
  function schTap(x){var q=schQuests(todayKey()).filter(function(z){return z.id===x.sched})[0];if(!q||locked()||(S.timer&&S.timer.id===q.id))return;go("today");if(x.j5)start5(q);else toggleTimer(q)}
