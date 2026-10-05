  /* ---- to-do lifecycle: done ones vanish after their day, open ones get a keep-or-clear review ---- */
  function openTodos(){return cfg().quests.filter(function(q){return q.type==="todo"&&!q.doneOn&&!q.completed})}
  function cleanDoneTodos(){var T=todayKey(),c=cfg();if(!(c.quests||[]).some(function(q){return q.type==="todo"&&((q.doneOn&&q.doneOn<T)||!q.addedOn)}))return;var c2=clone(c);c2.quests=c2.quests.filter(function(q){return !(q.type==="todo"&&q.doneOn&&q.doneOn<T)}).map(function(q){if(q.type==="todo"&&!q.addedOn)q.addedOn=T;return q});saveCfg(c2);qSig=""}
  var todoReviewOpen=false;
  function reviewTodos(reason){
    var L=openTodos();if(!L.length||todoReviewOpen)return;todoReviewOpen=true;var drop={};
    openG("Still need these to-dos?",function(b){
      function draw(){b.innerHTML='<p class="help">'+(reason==="endday"?"The day is done. ":"")+'Keep what you still need; delete the rest.</p><div class="dtl">'+L.map(function(q){var d=!!drop[q.id];return '<div class="dt-r tdrev"><span>'+esc(q.label)+(q.due?' <em>due '+fmtD(q.due)+'</em>':'')+'</span><button type="button" class="stone mini'+(d?' del':' on')+'" data-tdr="'+q.id+'" aria-pressed="'+d+'">'+(d?'Delete':'Keep')+'</button></div>'}).join("")+'</div><div class="edrow end"><button type="button" class="stone del" id="tdrAll">Delete all</button><button type="button" class="stone save" id="tdrGo">Done</button></div>';
        b.querySelectorAll("[data-tdr]").forEach(function(x){x.addEventListener("click",function(){var id=x.getAttribute("data-tdr");drop[id]=!drop[id];draw()})});
        b.querySelector("#tdrAll").addEventListener("click",function(){L.forEach(function(q){drop[q.id]=true});finish()});
        b.querySelector("#tdrGo").addEventListener("click",finish)}
      function finish(){var ids=Object.keys(drop).filter(function(k){return drop[k]});if(ids.length){var c=clone(cfg());c.quests=c.quests.filter(function(q){return ids.indexOf(q.id)<0});saveCfg(c);var T=todayKey();if(S.days[T]&&!S.days[T].ended){S.days[T]=Object.assign({},S.days[T],{q:activeDefs(T)});dirty[T]=true;cache()}qSig="";render()}
        try{localStorage.setItem("pc-todoreview",reason==="endday"?add(todayKey(),1):todayKey())}catch(x){}closeG();if(ids.length)setSync(ids.length+" to-do"+(ids.length===1?"":"s")+" deleted")}
      draw()},function(){todoReviewOpen=false})}
  function reviewDue(){var T=todayKey(),last="";try{last=localStorage.getItem("pc-todoreview")||""}catch(x){}if(last>=T||locked()||S.timer||(typeof groveOpen!=="undefined"&&groveOpen))return false;
    if(!openTodos().some(function(q){return (q.addedOn||"")<T}))return false;
    return document.getElementById("gModal").hidden&&document.getElementById("nqModal").hidden}
  function maybeReviewTodos(){if(reviewDue())setTimeout(function(){if(reviewDue())reviewTodos("open")},600)}
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")maybeReviewTodos()});
  (function(){var ln=LN();if(!ln||!ln.addListener)return;try{ln.addListener("localNotificationActionPerformed",function(ev){var n=ev&&ev.notification;if(n)setTimeout(function(){notifAction(n.id,n.extra||{})},500)})}catch(x){}})();
