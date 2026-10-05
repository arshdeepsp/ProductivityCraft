  /* ---- today's schedule ----
     Places today's time quests on Your day. Stored on the day entry as e.sched = {questId: {f, t, j5}},
     minutes from that day's midnight (same scale as dayWin). j5 = "5-min start": fixed length (schLen), its
     notification starts Just 5. Planning only: hasEntry ignores it, so it never affects clearing or streaks. */
  var SCH_STEP=15,SCH_ROW=18,schSel=null,schMsg="",schBody=null,schDrag=null;
  function schQuests(k){return activeDefs(k).filter(function(q){return q.type==="time"&&!q.off})}
  function schLen(q){var m=q.roll?q.roll/weekWorkDays(q):q.min;return Math.max(SCH_STEP,Math.ceil(m/5)*5)}
  function schOf(k){return ((S.days[k]||{}).sched)||{}}
  function hhmmOf(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
  function schText(b){return b.j5?"5-min start "+hhmmOf(b.f):hhmmOf(b.f)+"–"+hhmmOf(b.t)}
  function schFloor(){return Math.floor(nowMinInDay()/SCH_STEP)*SCH_STEP}
  function schClash(sc,id,f,t){var hit=null;Object.keys(sc).forEach(function(o){if(o!==id&&sc[o].f<t&&f<sc[o].t)hit=o});return hit}
  function schNext(sc,id,f,cap){var n=cap;Object.keys(sc).forEach(function(o){if(o!==id&&sc[o].f>=f&&sc[o].f<n)n=sc[o].f});return n}
  function schLabel(id){var q=schQuests(todayKey()).filter(function(x){return x.id===id})[0];return q?q.label:"another quest"}
  function schSave(fn){if(locked())return false;var e=entry(),sc={};Object.keys(e.sched||{}).forEach(function(k){sc[k]=Object.assign({},e.sched[k])});fn(sc);if(Object.keys(sc).length)e.sched=sc;else delete e.sched;commit();return true}
  function schPlace(id,m){var T=todayKey(),w=dayWin(T),q=schQuests(T).filter(function(x){return x.id===id})[0];if(!q)return;
    var sc=schOf(T),old=sc[id],j5=!!(old&&old.j5),len=old&&!j5?old.t-old.f:schLen(q),f=m,t=Math.min(w.e,f+len);
    if(f<schFloor()){schMsg="That time has already passed.";return}
    if(t-f<SCH_STEP){schMsg="That’s too close to bedtime.";return}
    var c=schClash(sc,id,f,t);if(c){schMsg="That overlaps "+schLabel(c)+". Pick a free time, or shorten it first.";return}
    schSave(function(s){s[id]={f:f,t:t};if(j5)s[id].j5=true});schMsg="";schSel=null}
  function schMode(id,j5){var T=todayKey(),w=dayWin(T),q=schQuests(T).filter(function(x){return x.id===id})[0],sc=schOf(T),b=sc[id];if(!q||!b||!!b.j5===j5)return;
    var t=j5?Math.min(schNext(sc,id,b.f,w.e),b.f+schLen(q)):b.t;schSave(function(s){s[id]={f:b.f,t:t};if(j5)s[id].j5=true})}
  function schRemove(id){schSave(function(s){delete s[id]});schSel=null}
  function openSchedule(){if(locked())return;schSel=null;schMsg="";openG("Today’s schedule",function(b){schBody=b;schDraw(true)},function(){schBody=null;schDrag=null})}
  function schDraw(first){var b=schBody;if(!b)return;var T=todayKey(),w=dayWin(T),Q=schQuests(T),sc=schOf(T),e=S.days[T]||{};
    if(!Q.length){b.innerHTML='<p class="help">No time quests today. Add one to schedule it.</p><div class="edrow end"><button type="button" class="stone save" id="schOk">Close</button></div>';b.querySelector("#schOk").addEventListener("click",closeG);return}
    if(schSel&&!Q.some(function(q){return q.id===schSel}))schSel=null;
    var s0=Math.floor(w.s/SCH_STEP)*SCH_STEP,e0=Math.ceil(w.e/SCH_STEP)*SCH_STEP,px=function(m){return (m-s0)/SCH_STEP*SCH_ROW},fl=schFloor(),now=nowMinInDay(),sel=schSel?Q.filter(function(q){return q.id===schSel})[0]:null,ps=sel&&sc[sel.id],tot=0,n=0;
    Object.keys(sc).forEach(function(id){if(Q.some(function(q){return q.id===id})){n++;tot+=sc[id].t-sc[id].f}});
    var h='<div class="sch-top"><p class="sch-sum">'+esc(w.wake)+'–'+esc(w.bed)+(w.today?' (today only)':'')+' · '+n+' of '+Q.length+' placed'+(tot?' · '+hm(tot)+' blocked':'')+'</p>';
    h+='<div class="sch-tray">'+Q.map(function(q){var p=sc[q.id];return '<button type="button" class="stone mini sch-q'+(schSel===q.id?' on':'')+(p?' placed':'')+'" data-sq="'+q.id+'" aria-pressed="'+(schSel===q.id)+'">'+esc(q.label)+' <small>'+(p?schText(p):hm(schLen(q)))+'</small></button>'}).join("")+'</div>';
    if(ps)h+='<div class="sch-bar"><div class="sjpick" role="radiogroup" aria-label="How to start"><button type="button" class="stone mini'+(ps.j5?'':' on')+'" data-sm="range" role="radio" aria-checked="'+!ps.j5+'">Time range</button><button type="button" class="stone mini'+(ps.j5?' on':'')+'" data-sm="j5" role="radio" aria-checked="'+!!ps.j5+'">5-min start</button></div><button type="button" class="stone mini del" id="schRm">Remove</button></div>';
    h+='<p class="help sch-help">'+(sel?(ps?(ps.j5?'5-min start: blocks '+hm(schLen(sel))+' (its daily share). Its notification starts a 5-minute timer. Tap a free time to move it.':'Tap a free time to move it. Drag the bottom edge to change its length.'):'Tap a time to place '+esc(sel.label)+' ('+hm(schLen(sel))+').'):'Tap a quest, then tap a time.')+'</p>'+(schMsg?'<p class="cmsg2">'+esc(schMsg)+'</p>':'')+'</div>';
    h+='<div class="sch-tl" id="schTl" style="height:'+px(e0)+'px">';
    for(var m=s0;m<e0;m+=SCH_STEP)h+='<i class="sch-ln'+(m%60===0?' hr':'')+'" style="top:'+px(m)+'px"></i>'+(m%60===0?'<span class="sch-hr" style="top:'+px(m)+'px">'+hhmmOf(m)+'</span>':'');
    if(fl>s0)h+='<i class="sch-past" style="height:'+Math.min(px(e0),px(fl))+'px"></i>';
    if(now>=s0&&now<=e0)h+='<i class="sch-now" id="schNow" style="top:'+px(now)+'px"></i>';
    Object.keys(sc).forEach(function(id){var q=Q.filter(function(x){return x.id===id})[0];if(!q)return;var bl=sc[id],met=metQ(q,e);
      h+='<div class="sch-b'+(bl.j5?' j5':'')+(schSel===id?' on':'')+(met?' met':'')+'" data-sb="'+id+'" style="top:'+px(bl.f)+'px;height:'+Math.max(SCH_ROW,px(bl.t)-px(bl.f))+'px"><b>'+(bl.j5?'▶ 5 · ':'')+esc(q.label)+'</b><span>'+hhmmOf(bl.f)+'–'+hhmmOf(bl.t)+(met?' ✔':'')+'</span>'+(bl.j5?'':'<i class="sch-h" data-sh="'+id+'" aria-label="Drag to change length"></i>')+'</div>'});
    h+='</div><div class="edrow end">'+(n?'<button type="button" class="stone del" id="schClr">Clear all</button>':'')+'<button type="button" class="stone save" id="schOk">Done</button></div>';
    b.innerHTML=h;
    b.querySelectorAll("[data-sq]").forEach(function(x){x.addEventListener("click",function(){var id=x.getAttribute("data-sq");schSel=schSel===id?null:id;schMsg="";schDraw()})});
    b.querySelectorAll("[data-sm]").forEach(function(x){x.addEventListener("click",function(){schMode(schSel,x.getAttribute("data-sm")==="j5");schDraw()})});
    var rm=b.querySelector("#schRm");if(rm)rm.addEventListener("click",function(){schRemove(schSel);schDraw()});
    var cl=b.querySelector("#schClr"),arm=null;if(cl)cl.addEventListener("click",function(){if(!arm){cl.textContent="Confirm clear";arm=setTimeout(function(){arm=null;cl.textContent="Clear all"},4000);return}clearTimeout(arm);schSave(function(s){Object.keys(s).forEach(function(k){delete s[k]})});schSel=null;schDraw()});
    b.querySelector("#schOk").addEventListener("click",closeG);
    var tl=b.querySelector("#schTl");
    tl.addEventListener("click",function(ev){if(schDrag)return;var bk=ev.target.closest("[data-sb]");if(bk){var id=bk.getAttribute("data-sb");schSel=schSel===id?null:id;schMsg="";schDraw();return}
      if(!schSel){schMsg="Tap a quest first, then a time.";schDraw();return}var r=tl.getBoundingClientRect(),m2=s0+Math.floor((ev.clientY-r.top)/SCH_ROW)*SCH_STEP;schPlace(schSel,m2);schDraw()});
    tl.querySelectorAll("[data-sh]").forEach(function(hd){hd.addEventListener("pointerdown",function(ev){ev.preventDefault();ev.stopPropagation();var id=hd.getAttribute("data-sh"),bl=sc[id],blk=hd.parentNode,cap=schNext(sc,id,bl.f+1,w.e),t=bl.t;schDrag={id:id};try{hd.setPointerCapture(ev.pointerId)}catch(x){}
      function mv(e2){var r=tl.getBoundingClientRect();t=Math.max(bl.f+SCH_STEP,Math.min(cap,s0+Math.round((e2.clientY-r.top)/SCH_ROW)*SCH_STEP));blk.style.height=(px(t)-px(bl.f))+"px";blk.querySelector("span").textContent=hhmmOf(bl.f)+"–"+hhmmOf(t)}
      function up(){hd.removeEventListener("pointermove",mv);hd.removeEventListener("pointerup",up);hd.removeEventListener("pointercancel",up);if(t!==bl.t)schSave(function(s){s[id]={f:bl.f,t:t}});schSel=id;setTimeout(function(){schDrag=null;schDraw()},0)}
      hd.addEventListener("pointermove",mv);hd.addEventListener("pointerup",up);hd.addEventListener("pointercancel",up)})});
    if(first){var nw=b.querySelector("#schNow");if(nw)setTimeout(function(){try{nw.scrollIntoView({block:"center"})}catch(x){}},30)}
  }
  function schRows(defs,k){var sc=schOf(k);defs.forEach(function(q){var el=qEls[q.id],bl=sc[q.id];if(!el||!bl||q.type!=="time")return;var rq=el.row.querySelector(".req");if(rq&&rq.textContent.indexOf(schText(bl))<0)rq.textContent+=" · "+schText(bl)})}
  function schNotifs(T,e,push){var sc=schOf(T),Q=schQuests(T);Object.keys(sc).sort().forEach(function(id,i){var q=Q.filter(function(x){return x.id===id})[0],bl=sc[id];if(!q||metQ(q,e)||(S.timer&&S.timer.id===id))return;
      push(3500+i,(bl.j5?"5 minutes on ":"Time for ")+q.label,bl.j5?"Tap to start a 5-minute timer. Planned until "+hhmmOf(bl.t)+".":hhmmOf(bl.f)+"–"+hhmmOf(bl.t)+". Tap to start the timer.",atMin(T,bl.f),{sched:id,j5:!!bl.j5})})}
  function schTap(x){var q=schQuests(todayKey()).filter(function(z){return z.id===x.sched})[0];if(!q||locked()||(S.timer&&S.timer.id===q.id))return;go("today");if(x.j5)start5(q);else toggleTimer(q)}
