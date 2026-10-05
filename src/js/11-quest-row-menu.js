  /* ---- quest row menu ---- */
  var qmenu=null;
  function closeQMenu(){if(qmenu){qmenu.remove();qmenu=null}}
  document.addEventListener("click",function(e){if(qmenu&&!qmenu.contains(e.target))closeQMenu()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")closeQMenu()});
  function pauseQuest(q){var cq=cfg().quests.filter(function(x){return x.id===q.id})[0];if(cq&&lockOf(cq)==="fortnight"&&!easeInfo().setup){var d1=queueChange(q.id,"pause");render();setSync(q.label+" is locked. Pause scheduled for "+fmtD(d1)+".");return}var T=todayKey(),c6=clone(cfg()),oldQ=clone(c6.quests),qs=c6.quests,t=qs.filter(function(x){return x.id===q.id})[0];if(!t)return;var inf0=easeInfo();t.pausedFrom=inf0.setup?T:add(T,1);t.pausedUntil=add(t.pausedFrom,7);var g=guardEasing(c6,oldQ,[q.id]);if(!g.ok){setSync(g.msg);return}saveCfg(c6);if(g.eased){qSig="";render();setSync(q.label+" will be paused from tomorrow for 7 days ("+g.left+"/"+EASE_BUDGET+" easing changes left this week).");return}if(S.days[T]&&!S.days[T].ended){S.days[T]=Object.assign({},S.days[T],{q:activeDefs(T)});dirty[T]=true;cache();clearTimeout(timer);timer=setTimeout(flush,300)}qSig="";render();setSync(q.label+" paused until "+fmtD(add(T,6)))}
  function deleteTodo(q){var c=clone(cfg());c.quests=c.quests.filter(function(x){return x.id!==q.id});saveCfg(c);var T=todayKey();if(S.days[T]&&!S.days[T].ended){var e=Object.assign({},S.days[T]);delete e[q.id];e.q=activeDefs(T);S.days[T]=e;dirty[T]=true;cache();clearTimeout(timer);timer=setTimeout(flush,300)}qSig="";render();setSync("To-do deleted")}
  function openQMenu(q,btn){
    closeQMenu();if(locked())return;
    var items=q.type==="todo"?[["View details",function(){openDetails(q)}],["Delete to-do",function(){deleteTodo(q)}]]:[["Pause for 7 days",function(){pauseQuest(q)}],["Edit quests",function(){openMgr()}]];if(q.type==="time"&&!(S.timer&&S.timer.id===q.id))items.unshift(["Just 5 minutes on this",function(){start5(q)}]);if(q.type!=="todo")items.unshift(["View details",function(){openDetails(q)}]);if(q.type!=="todo"){var cq0=cfg().quests.filter(function(z){return z.id===q.id})[0];if(cq0&&!cq0.completed)items.splice(items.length,0,["Mark complete",function(){markCompleteManual(q)}]);if(cq0&&cq0.pending)items.unshift(["Cancel scheduled "+pendText(cq0.pending).toLowerCase(),function(){cancelPending(q.id)}])}
    popMenu(btn,items);
  }
  function popMenu(btn,items){
    closeQMenu();items=items.concat([["Cancel",function(){}]]);var m=document.createElement("div");m.className="qmenu";m.setAttribute("role","menu");
    m.innerHTML=items.map(function(it,i){return '<button type="button" role="menuitem" data-mi="'+i+'">'+it[0]+'</button>'}).join("");
    document.body.appendChild(m);var r=btn.getBoundingClientRect();m.style.top=(window.scrollY+r.bottom+6)+"px";m.style.left=Math.max(8,Math.min(window.scrollX+r.left,window.scrollX+document.documentElement.clientWidth-m.offsetWidth-8))+"px";
    m.querySelectorAll("[data-mi]").forEach(function(b){b.addEventListener("click",function(e){e.stopPropagation();var f=items[+b.getAttribute("data-mi")][1];closeQMenu();f()})});
    qmenu=m;m.querySelector("button").focus();
  }
