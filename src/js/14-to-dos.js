  /* ---- to-dos ---- */
  function toggleTodo(q){
    if(locked())return;var T=todayKey(),c=clone(cfg()),t=c.quests.filter(function(x){return x.id===q.id})[0];if(!t)return;
    var e=entry(),done=!e[q.id];if(done){e[q.id]=true;t.doneOn=T}else{delete e[q.id];delete t.doneOn}
    saveCfg(c);e.q=activeDefs(T);commit();if(done)setSync("To-do done: "+q.label);
  }
  (function(){var inp=document.getElementById("tdNew"),btn=document.getElementById("tdAdd");if(!inp)return;
    function addTd(){var l=inp.value.trim();if(!l||locked())return;var c=clone(cfg());c.quests.push({id:"td"+Date.now().toString(36),type:"todo",label:l.slice(0,60),addedOn:todayKey()});saveCfg(c);inp.value="";var T=todayKey();if(S.days[T]&&!S.days[T].ended){S.days[T]=Object.assign({},S.days[T],{q:activeDefs(T)});dirty[T]=true;cache()}qSig="";render();setSync("To-do added")}
    btn.addEventListener("click",addTd);inp.addEventListener("keydown",function(e){if(e.key==="Enter")addTd()});
  })();
  /* ---- to-do lifecycle: done ones clear after their day, leftovers get a review ---- */
  function pruneTodos(){var T=todayKey(),c=cfg(),qs=c.quests||[],stale=qs.some(function(q){return q.type==="todo"&&((q.doneOn&&q.doneOn<T)||!q.addedOn)});if(!stale)return;
    var c2=clone(c);c2.quests=c2.quests.filter(function(q){return !(q.type==="todo"&&q.doneOn&&q.doneOn<T)}).map(function(q){if(q.type==="todo"&&!q.addedOn)q.addedOn=T;return q});saveCfg(c2);qSig=""}
  var todoReviewShown=false;
  function leftoverTodos(all){var T=todayKey(),e=S.days[T]||{};return cfg().quests.filter(function(q){return q.type==="todo"&&!q.doneOn&&!e[q.id]&&(all||(q.addedOn||T)<T)})}
  function reviewTodos(afterEnd){var T=todayKey(),L=leftoverTodos(afterEnd);if(!L.length)return false;var keep={};L.forEach(function(q){keep[q.id]=true});
    openG(afterEnd?"Unfinished to-dos":"Still need these?",function(b){
      function draw(){b.innerHTML='<p class="help">'+(afterEnd?"These weren\u2019t done today. Keep the ones you still need; the rest are deleted.":"Left over from before today. Keep the ones you still need; the rest are deleted.")+'</p><div class="dtl">'+L.map(function(q){var k=keep[q.id];return '<div class="dt-r"><span>'+esc(q.label)+'</span><button type="button" class="stone mini'+(k?' on':' del')+'" data-kt="'+q.id+'">'+(k?"Keep":"Delete")+'</button></div>'}).join("")+'</div><div class="edrow end"><button type="button" class="stone del" id="tdrAll">Delete all</button><button type="button" class="stone save" id="tdrGo">Done</button></div>';
        b.querySelectorAll("[data-kt]").forEach(function(x){x.addEventListener("click",function(){var id=x.getAttribute("data-kt");keep[id]=!keep[id];draw()})});
        b.querySelector("#tdrAll").addEventListener("click",function(){L.forEach(function(q){keep[q.id]=false});apply()});
        b.querySelector("#tdrGo").addEventListener("click",apply)}
      function apply(){var drop=L.filter(function(q){return !keep[q.id]}).map(function(q){return q.id});
        if(drop.length){var c2=clone(cfg());c2.quests=c2.quests.filter(function(q){return drop.indexOf(q.id)<0});saveCfg(c2);var T2=todayKey();if(S.days[T2]&&!S.days[T2].ended){S.days[T2]=Object.assign({},S.days[T2],{q:activeDefs(T2)});dirty[T2]=true;cache()}qSig="";render()}
        try{localStorage.setItem("pc-todoreview",afterEnd?add(T,1):T)}catch(x){}
        closeG();setSync(drop.length?drop.length+" to-do"+(drop.length===1?"":"s")+" deleted":"To-dos kept")}
      draw()});return true}
  function maybeReviewTodos(){if(todoReviewShown||ro()||locked())return;var T=todayKey(),last="";try{last=localStorage.getItem("pc-todoreview")||""}catch(x){}if(last>=T)return;
    if(!document.getElementById("gModal").hidden||!document.getElementById("nqModal").hidden||(typeof groveOpen!=="undefined"&&groveOpen)||S.timer)return;
    if(!leftoverTodos(false).length)return;todoReviewShown=true;setTimeout(function(){if(document.getElementById("gModal").hidden)reviewTodos(false)},600)}
