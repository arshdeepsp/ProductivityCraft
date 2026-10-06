  /* ---- focus timer ---- */
  function fmtT(ms){var s=Math.floor(ms/1000),m=Math.floor(s/60);return (m>=60?Math.floor(m/60)+":"+String(m%60).padStart(2,"0"):m)+":"+String(s%60).padStart(2,"0")}
  function toggleTimer(q){
    if(locked())return;var now=Date.now(),T=todayKey();
    if(S.timer&&S.timer.id===q.id){var el0=(Date.now()-S.timer.start)/60000;if(commitOn()&&S.timer.quick&&S.timer.commit&&el0<S.timer.commit){var left=Math.max(1,Math.ceil(S.timer.commit-el0));openG("Almost there",function(b){b.innerHTML='<p class="mhead">Only '+left+' more minute'+(left===1?'':'s')+' to your 5.</p><p class="help">No penalty either way, but reaching the chime is the whole point. Keep going?</p><div class="edrow end"><button type="button" class="stone" id="j5Stop">Stop now</button><button type="button" class="stone save" id="j5Keep">Keep going</button></div>';b.querySelector("#j5Keep").addEventListener("click",closeG);b.querySelector("#j5Stop").addEventListener("click",function(){closeG();stopTimer()})});return}
    if(commitOn()&&!S.timer.quick&&el0<COMMIT_MIN){openG("Stop early?",function(b){b.innerHTML='<p class="mhead bad">You committed to '+COMMIT_MIN+' minutes.</p><p class="help">You\u2019re '+Math.floor(el0)+' minutes in. Stopping now counts as an early stop: \u2212'+BREAK_XP+' XP and your momentum resets. Your '+Math.round(el0)+' minutes still count toward the quest.</p><div class="edrow end"><button type="button" class="stone del" id="esStop">Stop anyway</button><button type="button" class="stone save" id="esKeep">Keep going</button></div>';b.querySelector("#esKeep").addEventListener("click",closeG);b.querySelector("#esStop").addEventListener("click",function(){closeG();stopTimer()})});return}stopTimer();return}
    var quick=!!S.noTopicAsk;
    function startNow(first){var now2=Date.now();if(S.timer)stopTimer();var e0=S.days[T]||{},lg=e0[q.id]|0;S.timer={id:q.id,label:q.label,start:now2,day:T,minHit:lg>=q.min,planHit:lg>=planOf(q,e0),first:first||null,quick:quick,autoFocus:!focusView};timerTopicStart(q);callCheck();if(!focusView){focusView=true;applyHide()}cache();timerTick();setSync(first?"Timer started. First step: "+first:"Timer started: "+q.label);notifSync();setTimeout(focusSync,0)}
    if(quick){startNow("");return}
    confirmCommit("timer",{label:q.label},startNow);
  }
  function stopTimer(){
    rollTimer();var t=S.timer;if(!t)return;S.timer=null;cache();notifSync();setTimeout(function(){focusSync(true)},0);if(t.autoFocus){focusView=false;try{localStorage.setItem("pc-focusview","0")}catch(x){}applyHide()}var m=Math.round((Date.now()-t.start)/60000),T=todayKey();if(!t.quick&&!t.noPenalty&&commitOn()&&m<COMMIT_MIN){setTimeout(function(){markBroken(T,"Early stop")},0)}
    if(m<1){setSync("Timer stopped (under a minute).");timerTick();return}
    if(logTimer(t,T,Date.now())){render(true);setSync("+"+hm(m)+" added to "+t.label);return}
    setSync("Timer stopped: "+hm(m)+" could not be added (day locked or quest not active).");render();
  }
  /* Log a running timer's minutes from t.start to end onto day k: session, topic time and the quest's minutes. */
  function logTimer(t,k,end){var m=Math.round((end-t.start)/60000);if(m<1)return false;addSession(k,t.id,t.start,end);var tsp=topicSplit(t,end);Object.keys(tsp).forEach(function(id){addTopicTime(k,id,tsp[id])});
    var e=Object.assign({},S.days[k]||{}),past=k<todayKey();if(!past)e.q=activeDefs(k);var L=e.q||activeDefs(k);if(!L.some(function(x){return x.id===t.id}))return false;
    e[t.id]=Math.min(MAXM,(e[t.id]|0)+m);S.days[k]=e;dirty[k]=true;cache();clearTimeout(timer);timer=setTimeout(flush,300);return true}
  /* A timer still running when its day locks: the minutes up to the lock go to that day, the rest start fresh on today. */
  function rollTimer(){var t=S.timer,T=todayKey();if(!t||!t.day||t.day>=T)return;var cut=atMin(add(t.day,1),dayEnd()*60),now=Date.now();cut=Math.max(t.start,Math.min(cut,now));
    logTimer(t,t.day,cut);t.start=cut;t.day=T;t.tAt=cut;t.tacc={};t.noPenalty=true;var q=cfgQ(t.id),e0=S.days[T]||{};t.minHit=!!q&&(e0[t.id]|0)>=(q.min|0);t.planHit=!!q&&(e0[t.id]|0)>=planOf(q,e0);t.c5=true;cache();setTimeout(focusSync,0)}
  function timerGoals(){
    var t=S.timer;if(!t)return;if(t.commit&&!t.c5&&Date.now()-t.start>=t.commit*60000){t.c5=true;cache();sfx("chime");try{if(navigator.vibrate)navigator.vibrate([120,60,120])}catch(x){}setSync("5 minutes in! Keep going, or stop the timer to log it.")}var T=todayKey(),q=activeDefs(T).filter(function(x){return x.id===t.id})[0];if(!q||q.type!=="time")return;
    var e=S.days[T]||{},tot=(e[q.id]|0)+Math.floor((Date.now()-t.start)/60000),pl=planOf(q,e),hit=null;
    if(!t.minHit&&tot>=q.min){t.minHit=true;hit="Minimum reached for "+q.label+" ("+hmL(q.min)+")"}
    if(cfg().showPlan&&pl>q.min&&!t.planHit&&tot>=pl){t.planHit=true;t.minHit=true;hit="Plan reached for "+q.label+" ("+hm(pl)+")"}
    if(hit){cache();sfx("chime");try{if(navigator.vibrate)navigator.vibrate([120,60,120,60,200])}catch(x){}setSync(hit+". Keep going or stop the timer to log it.")}
    var el=qEls[t.id];if(el&&el.tmr){el.tmr.classList.toggle("hit",!!t.minHit&&tot>=q.min);el.tmr.classList.toggle("gold",!!t.planHit&&pl>q.min&&tot>=pl)}
  }
  function timerTick(){var tmOn=!!(S.timer&&qEls[S.timer.id]&&!ro());qWrap.classList.toggle("timing",tmOn);document.getElementById("gui").classList.toggle("timing",tmOn);timerGoals();Object.keys(qEls).forEach(function(id){runBox(id);var el=qEls[id];if(!el||!el.tmr)return;var on=S.timer&&S.timer.id===id;el.tmr.classList.toggle("on",!!on);el.tmr.querySelector("span").textContent=on?fmtT(Date.now()-S.timer.start):"";el.tmr.setAttribute("aria-label",(on?"Stop":"Start")+" focus timer")})}
  setInterval(function(){if(S.timer)timerTick();renderHeat()},1000);
  function renderHeat(){var el=document.getElementById("heatBar");if(!el)return;var h=heat(),pc=Math.round(h/180*100),lab=h>=120?"On fire":h>=60?"Hot":h>=20?"Warm":"Cold";el.querySelector("i").style.width=pc+"%";el.className="heat "+(h>=120?"h3":h>=60?"h2":h>=20?"h1":"h0");document.getElementById("heatLab").textContent="Momentum: "+lab}
