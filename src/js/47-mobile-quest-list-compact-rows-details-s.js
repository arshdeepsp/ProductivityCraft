  /* ---- mobile quest list: compact rows, details sheet, run view ---- */
  var COLQ={time:1,target:1,limit:1,wake:1,scale:1};
  function qSummary(q,e){var v=e[q.id];
    if(q.type==="time"){var d=+v||0;return q.roll?hm(rollSum(q.id,todayKey()))+"/"+hm(rollNeed(q,todayKey()))+" wk":hm(d)+" / "+hm(q.min)}
    if(q.type==="target")return num(v||0)+" / "+num(q.min)+(q.ul?" "+q.ul:"");
    if(q.type==="limit")return (q.unit==="min"?hm(+v||0):num(v||0))+" / "+(q.unit==="min"?hm(q.max):num(q.max));
    if(q.type==="wake")return v?String(v):"--:--";
    if(q.type==="scale")return v?v+" / "+(q.scale||5):"\u2014";
    return ""}
  function openDetails(q){var T=todayKey(),e=S.days[T]||{},cq=cfg().quests.filter(function(x){return x.id===q.id})[0]||q,sj=q.subj?subjById(q.subj):null,DN=["Su","Mo","Tu","We","Th","Fr","Sa"];
    openG(q.label,function(b){var rows=[];function r(k,v){rows.push('<div class="dt-r"><span>'+k+'</span><b>'+v+'</b></div>')}
      r("Goal",esc(reqText(q)));if(q.type==="time"&&q.roll){var cvd=emptyCover(T);if(cvd!=null)r("Empty days covered",cvd===0?"none right now":cvd+" from today");var rs=rollSum(q.id,T),rn=rollNeed(q,T);r("This week",hm(rs)+" of "+hm(rn)+(rs>=rn?" \u00b7 ahead "+hm(rs-rn):" \u00b7 behind "+hm(rn-rs)))}
      
      if(q.total)r("Project total",(q.type==="time"?hm(projSum(q.id)):num(projSum(q.id)))+" of "+(q.type==="time"?hm(q.total):num(q.total)));
      if(q.note)r("Note",esc(q.note));
      r("Days",q.days&&q.days.length&&q.days.length<7?q.days.map(function(d){return DN[d]}).join(" "):"Every day");
      if(q.opt)r("Optional","Yes");
      if(sj)r("Subject",esc(sj.name)+(q.topic?" \u203a "+esc(topicName(q.topic)):""));
      if(cq.fin)r("Done when",cq.fin.t==="total"?"Project total reached":(cq.fin.t==="topic"?"Topic reaches ":"Subject reaches ")+LV[cq.fin.lvl||4]);
      if(q.dl)r("Deadline",num(q.dl.total)+(q.ul?" "+esc(q.ul):"")+" by "+fmtD(q.dl.due));
      if(q.type!=="todo"&&strictOn())r("Change rules",(LOCKS.filter(function(L){return L[0]===lockOf(cq)})[0]||LOCKS[0])[1]);
      if(cq.pending)r("Scheduled",pendText(cq.pending)+" on "+fmtD(cq.pending.due));
      b.innerHTML='<div class="dtl">'+rows.join("")+'</div><div class="edrow end"><button type="button" class="stone" id="dtEdit">Edit quests</button><button type="button" class="stone save" id="dtOk">Close</button></div>';
      b.querySelector("#dtOk").addEventListener("click",closeG);b.querySelector("#dtEdit").addEventListener("click",function(){closeG();openMgr()})})}
  var doneOpen=false;try{doneOpen=localStorage.getItem("pc-doneopen")==="1"}catch(x){}
  function mobileList(defs,e,past){
    var sep=document.getElementById("doneSep");if(!sep){sep=document.createElement("button");sep.type="button";sep.id="doneSep";sep.className="donesep";sep.addEventListener("click",function(){doneOpen=!doneOpen;try{localStorage.setItem("pc-doneopen",doneOpen?"1":"0")}catch(x){}mobileList(defs,S.days[todayKey()]||{},ro())})}
    if(sep.parentNode!==qWrap)qWrap.appendChild(sep);
    var nDone=0;defs.forEach(function(q){var el=qEls[q.id];if(!el)return;var row=el.row,isDone=row.classList.contains("met")&&q.type!=="limit"&&!(S.timer&&S.timer.id===q.id);row.classList.toggle("indone",isDone);if(isDone)nDone++;
      row.classList.toggle("colq",!!COLQ[q.type]);if(q.type==="weekly"){var ws=row.querySelector(".wksub"),wkt=row.querySelector(".wk");if(!ws){ws=document.createElement("span");ws.className="wksub";row.children[3].appendChild(ws)}ws.textContent=wkt?wkt.textContent:""}var sm=row.querySelector(".qsum");if(COLQ[q.type]){if(!sm){sm=document.createElement("button");sm.type="button";sm.className="qsum";sm.addEventListener("click",function(){row.classList.toggle("open")});row.appendChild(sm)}sm.textContent=qSummary(q,e)}});
    var gh=document.getElementById("tdGhost");if(!gh){gh=document.createElement("div");gh.id="tdGhost";gh.className="tdghost";gh.innerHTML='<input maxlength="60" placeholder="+ Add a to-do" aria-label="New to-do"><button type="button" class="stone">Add</button>';var gi=gh.querySelector("input");function addG(){var v=gi.value.trim();if(!v)return;var tn=document.getElementById("tdNew");tn.value=v;document.getElementById("tdAdd").click();gi.value="";setTimeout(function(){var g2=document.querySelector("#tdGhost input");if(g2)g2.focus()},60)}gh.querySelector("button").addEventListener("click",addG);gi.addEventListener("keydown",function(ev){if(ev.key==="Enter")addG()})}
    if(gh.parentNode!==qWrap)qWrap.appendChild(gh);gh.hidden=past||locked();
    document.body.classList.toggle("spark-on",!!cfg().sparkTools);document.body.classList.toggle("past-view",!!past);
    sep.hidden=!nDone;sep.innerHTML="<span>Done today ("+nDone+")</span><i class=\"chev\"></i>";sep.setAttribute("aria-expanded",doneOpen);qWrap.classList.toggle("done-open",doneOpen);
    var dc=document.getElementById("qCount"),rq=reqOf(defs).filter(function(q){return q.type!=="limit"});if(dc){dc.textContent=rq.filter(function(q){return metQ(q,e)}).length+"/"+rq.length+" done";dc.hidden=!rq.length;if(!dc.dataset.w){dc.dataset.w=1;dc.setAttribute("role","button");dc.tabIndex=0;dc.title="What counts?";dc.addEventListener("click",openCountInfo)}}}
  function openCountInfo(){var T=viewKey||todayKey(),e=S.days[T]||{},defs=defsOf(e).length?defsOf(e):activeDefs(T),rq=reqOf(defs).filter(function(q){return q.type!=="limit"}),skip=defs.filter(function(q){return rq.indexOf(q)<0});
    openG("Today\u2019s count",function(b){b.innerHTML='<p class="help">The count is required quests done today. Clear them all (and break no limit) to clear the day.</p><div class="dtl">'+rq.map(function(q){var m=metQ(q,e);return '<div class="dt-r"><span>'+esc(q.label)+'</span><b class="'+(m?'okc':'')+'">'+(m?'\u2714 Done':'To do')+'</b></div>'}).join("")+'</div>'+(skip.length?'<p class="sh2">Not counted</p><p class="help">'+skip.map(function(q){return esc(q.label)+' ('+(q.type==="limit"?"limit":q.type==="todo"?"to-do":q.type==="weekly"?"weekly goal":"optional")+')'}).join(", ")+'</p>':'')+'<div class="edrow end"><button type="button" class="stone save" id="ciOk">Got it</button></div>';b.querySelector("#ciOk").addEventListener("click",closeG)})}
  function runBox(id){var el=qEls[id];if(!el)return;var row=el.row,on=S.timer&&S.timer.id===id;row.classList.toggle("running",!!on);var rb=row.querySelector(".runbox");
    if(!on){if(rb)rb.remove();return}
    var q=activeDefs(todayKey()).filter(function(x){return x.id===id})[0];if(!q)return;
    if(!rb){rb=document.createElement("div");rb.className="runbox";rb.innerHTML='<div class="rb-t"></div><div class="rb-s"></div><div class="rb-b"><i></i></div><div class="rb-f"></div>';el.tmr.parentNode.insertBefore(rb,el.tmr)}
    var e=S.days[todayKey()]||{},el2=Date.now()-S.timer.start,mins=Math.floor(el2/60000),lg=+e[q.id]||0,tg=S.timer.commit&&!S.timer.c5?S.timer.commit:(q.roll?0:q.min),tot=lg+mins;
    rb.querySelector(".rb-t").textContent=fmtT(el2);
    rb.querySelector(".rb-s").textContent=S.timer.commit&&!S.timer.c5?"Just 5 minutes \u00b7 "+Math.max(0,5-mins)+" min to go":tg?hm(tot)+" of "+hm(tg)+(tot>=tg?" \u2714":""):hm(tot)+" today";
    rb.querySelector(".rb-b i").style.width=Math.min(100,tg?Math.round((S.timer.commit&&!S.timer.c5?mins/5:tot/tg)*100):100)+"%";
    rb.querySelector(".rb-f").textContent=S.timer.first?"First: "+S.timer.first:"";}
