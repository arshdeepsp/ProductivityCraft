  /* ---- today's schedule ----
     Places today's time quests on Your day. Stored on the day entry as e.sched = [{id, q, f, t, j5}]: one entry per
     block ("shot"), so a quest can be split into several. f/t are minutes from that day's midnight (dayWin scale).
     j5 = "5-min start": fixed length, its notification starts Just 5; otherwise a resizable range whose notification
     starts the normal timer. Planning only: hasEntry ignores it, so it never affects clearing or streaks. */
  var SCH_STEP=15,SCH_ROW=18,schSel=null,schQ=null,schMsg="",schBody=null,schDrag=null;
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
  function openSchedule(){if(locked())return;schSel=null;schQ=null;schMsg="";openG("Today’s schedule",function(b){schBody=b;schDraw(true)},function(){schBody=null;schDrag=null})}
  function schDraw(first){var b=schBody;if(!b)return;var T=todayKey(),w=dayWin(T),Q=schQuests(T),L=schAll(T).filter(function(x){return Q.some(function(q){return q.id===x.q})}),e=S.days[T]||{};
    if(!Q.length){b.innerHTML='<p class="help">No time quests today. Add one to schedule it.</p><div class="edrow end"><button type="button" class="stone save" id="schOk">Close</button></div>';b.querySelector("#schOk").addEventListener("click",closeG);return}
    if(schSel&&!L.some(function(x){return x.id===schSel}))schSel=null;if(schQ&&!Q.some(function(q){return q.id===schQ}))schQ=null;
    var s0=Math.floor(w.s/SCH_STEP)*SCH_STEP,e0=Math.ceil(w.e/SCH_STEP)*SCH_STEP,px=function(m){return (m-s0)/SCH_STEP*SCH_ROW},fl=schFloor(),now=nowMinInDay(),sb=schSel?L.filter(function(x){return x.id===schSel})[0]:null,sq=schQ?Q.filter(function(q){return q.id===schQ})[0]:null,tot=0,nq=0;
    L.forEach(function(x){tot+=x.t-x.f});Q.forEach(function(q){if(L.some(function(x){return x.q===q.id}))nq++});
    var h='<div class="sch-top"><p class="sch-sum">'+esc(w.wake)+'–'+esc(w.bed)+(w.today?' (today only)':'')+' · '+nq+' of '+Q.length+' placed'+(tot?' · '+hm(tot)+' blocked':'')+'</p>';
    h+='<div class="sch-tray">'+Q.map(function(q){var pl=schPlaced(T,q.id),n=L.filter(function(x){return x.q===q.id}).length,need=schLen(q);return '<button type="button" class="stone mini sch-q'+(schQ===q.id?' on':'')+(pl>=need?' placed':pl?' part':'')+'" data-sq="'+q.id+'" aria-pressed="'+(schQ===q.id)+'">'+esc(q.label)+' <small>'+(pl?hm(pl)+' / '+hm(need)+(n>1?' · '+n+' shots':''):hm(need))+'</small></button>'}).join("")+'</div>';
    if(sb)h+='<div class="sch-bar"><div class="sjpick" role="radiogroup" aria-label="How to start"><button type="button" class="stone mini'+(sb.j5?'':' on')+'" data-sm="range" role="radio" aria-checked="'+!sb.j5+'">Time range</button><button type="button" class="stone mini'+(sb.j5?' on':'')+'" data-sm="j5" role="radio" aria-checked="'+!!sb.j5+'">5-min start</button></div><span class="sch-act"><button type="button" class="stone mini" id="schSplit">Split</button><button type="button" class="stone mini del" id="schRm">Remove</button></span></div>';
    var help;if(sb)help=(sb.j5?'5-min start: its notification starts a 5-minute timer. ':'Drag the bottom edge to change its length. ')+'Tap a free time to move this shot, or Split to break it in two.';
    else if(sq){var lf=schLen(sq)-schPlaced(T,sq.id);help=lf>0?'Tap a time to place '+esc(sq.label)+' ('+hm(lf)+(schPlaced(T,sq.id)?' left':'')+').':esc(sq.label)+' is fully placed. Tap a time to add an extra shot (30m).'}
    else help='Tap a quest, then a time. Tap the quest again to add more shots at other times.';
    h+='<p class="help sch-help">'+help+'</p>'+(schMsg?'<p class="cmsg2">'+esc(schMsg)+'</p>':'')+'</div>';
    h+='<div class="sch-tl" id="schTl" style="height:'+px(e0)+'px">';
    for(var m=s0;m<e0;m+=SCH_STEP)h+='<i class="sch-ln'+(m%60===0?' hr':'')+'" style="top:'+px(m)+'px"></i>'+(m%60===0?'<span class="sch-hr" style="top:'+px(m)+'px">'+hhmmOf(m)+'</span>':'');
    if(fl>s0)h+='<i class="sch-past" style="height:'+Math.min(px(e0),px(fl))+'px"></i>';
    if(now>=s0&&now<=e0)h+='<i class="sch-now" id="schNow" style="top:'+px(now)+'px"></i>';
    L.forEach(function(bl){var q=Q.filter(function(x){return x.id===bl.q})[0],met=metQ(q,e),sh=L.filter(function(x){return x.q===bl.q}),ix=sh.indexOf(bl);
      h+='<div class="sch-b'+(bl.j5?' j5':'')+(schSel===bl.id?' on':'')+(met?' met':'')+'" data-sb="'+bl.id+'" style="top:'+px(bl.f)+'px;height:'+Math.max(SCH_ROW,px(bl.t)-px(bl.f))+'px"><b>'+(bl.j5?'▶ 5 · ':'')+esc(q.label)+(sh.length>1?' <em>'+(ix+1)+'/'+sh.length+'</em>':'')+'</b><span>'+hhmmOf(bl.f)+'–'+hhmmOf(bl.t)+(met?' ✔':'')+'</span>'+(bl.j5?'':'<i class="sch-h" data-sh="'+bl.id+'" aria-label="Drag to change length"></i>')+'</div>'});
    h+='</div><div class="edrow end">'+(L.length?'<button type="button" class="stone del" id="schClr">Clear all</button>':'')+'<button type="button" class="stone save" id="schOk">Done</button></div>';
    b.innerHTML=h;
    b.querySelectorAll("[data-sq]").forEach(function(x){x.addEventListener("click",function(){var id=x.getAttribute("data-sq");schQ=schQ===id?null:id;schSel=null;schMsg="";schDraw()})});
    b.querySelectorAll("[data-sm]").forEach(function(x){x.addEventListener("click",function(){schMode(schSel,x.getAttribute("data-sm")==="j5");schDraw()})});
    var sp=b.querySelector("#schSplit");if(sp)sp.addEventListener("click",function(){schSplit(schSel);schDraw()});
    var rm=b.querySelector("#schRm");if(rm)rm.addEventListener("click",function(){schRemove(schSel);schDraw()});
    var cl=b.querySelector("#schClr"),arm=null;if(cl)cl.addEventListener("click",function(){if(!arm){cl.textContent="Confirm clear";arm=setTimeout(function(){arm=null;cl.textContent="Clear all"},4000);return}clearTimeout(arm);schSave(function(){return []});schSel=null;schQ=null;schDraw()});
    b.querySelector("#schOk").addEventListener("click",closeG);
    var tl=b.querySelector("#schTl");
    tl.addEventListener("click",function(ev){if(schDrag)return;var bk=ev.target.closest("[data-sb]");if(bk){var id=bk.getAttribute("data-sb");schSel=schSel===id?null:id;schQ=null;schMsg="";schDraw();return}
      var r=tl.getBoundingClientRect(),m2=s0+Math.floor((ev.clientY-r.top)/SCH_ROW)*SCH_STEP;
      if(schSel)schMove(schSel,m2);else if(schQ)schAdd(schQ,m2);else schMsg="Tap a quest first, then a time.";schDraw()});
    tl.querySelectorAll("[data-sh]").forEach(function(hd){hd.addEventListener("pointerdown",function(ev){ev.preventDefault();ev.stopPropagation();var id=hd.getAttribute("data-sh"),bl=L.filter(function(x){return x.id===id})[0],blk=hd.parentNode,cap=schNext(L,id,bl.f+1,w.e),t=bl.t;schDrag={id:id};try{hd.setPointerCapture(ev.pointerId)}catch(x){}
      function mv(e2){var r=tl.getBoundingClientRect();t=Math.max(bl.f+SCH_STEP,Math.min(cap,s0+Math.round((e2.clientY-r.top)/SCH_ROW)*SCH_STEP));blk.style.height=(px(t)-px(bl.f))+"px";blk.querySelector("span").textContent=hhmmOf(bl.f)+"–"+hhmmOf(t)}
      function up(){hd.removeEventListener("pointermove",mv);hd.removeEventListener("pointerup",up);hd.removeEventListener("pointercancel",up);if(t!==bl.t)schSave(function(S2){S2.forEach(function(x){if(x.id===id)x.t=t})});schSel=id;schQ=null;setTimeout(function(){schDrag=null;schDraw()},0)}
      hd.addEventListener("pointermove",mv);hd.addEventListener("pointerup",up);hd.addEventListener("pointercancel",up)})});
    if(first){var nw=b.querySelector("#schNow");if(nw)setTimeout(function(){try{nw.scrollIntoView({block:"center"})}catch(x){}},30)}
  }
  function schRows(defs,k){defs.forEach(function(q){var el=qEls[q.id];if(!el||q.type!=="time")return;var L=schOfQ(k,q.id);if(!L.length)return;var txt=L.map(schText).join(", "),rq=el.row.querySelector(".req");if(rq&&rq.textContent.indexOf(txt)<0)rq.textContent+=" · "+txt})}
  function schNotifs(T,e,push){var Q=schQuests(T);schAll(T).forEach(function(bl,i){var q=Q.filter(function(x){return x.id===bl.q})[0];if(!q||metQ(q,e)||(S.timer&&S.timer.id===q.id))return;
      push(3500+i,(bl.j5?"5 minutes on ":"Time for ")+q.label,bl.j5?"Tap to start a 5-minute timer. Planned until "+hhmmOf(bl.t)+".":hhmmOf(bl.f)+"–"+hhmmOf(bl.t)+". Tap to start the timer.",atMin(T,bl.f),{sched:q.id,j5:!!bl.j5})})}
  function schTap(x){var q=schQuests(todayKey()).filter(function(z){return z.id===x.sched})[0];if(!q||locked()||(S.timer&&S.timer.id===q.id))return;go("today");if(x.j5)start5(q);else toggleTimer(q)}
