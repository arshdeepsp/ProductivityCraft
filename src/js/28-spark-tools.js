  /* ---- spark tools ---- */
  function pickPool(){var T=todayKey(),e=S.days[T]||{},out=[];activeDefs(T).forEach(function(q){
      if(q.type==="time"&&!metQ(q,e))out.push(q);else if((q.type==="check"||q.type==="todo"||q.type==="weekly")&&!e[q.id])out.push(q);else if(q.type==="target"&&!metQ(q,e))out.push(q)});return out}
  function behindTime(){var T=todayKey(),e=S.days[T]||{},L=activeDefs(T).filter(function(q){return q.type==="time"});if(!L.length)return null;L.sort(function(a,b){var ra=(e[a.id]|0)/Math.max(1,a.roll?a.roll/7:a.min),rb=(e[b.id]|0)/Math.max(1,b.roll?b.roll/7:b.min);if(ra!==rb)return ra-rb;var da=(a.roll?0:a.min)-(e[a.id]|0),db=(b.roll?0:b.min)-(e[b.id]|0);return db-da});return L[0]}
  function start5(q,after){if(locked())return;q=q||behindTime();if(!q){setSync("Add a time quest to use Just 5 minutes.");return}if(S.timer&&S.timer.id===q.id){setSync("Already running.");return}
    function go(first){S.noTopicAsk=true;toggleTimer(q);S.noTopicAsk=false;if(S.timer){S.timer.commit=5;if(first)S.timer.first=first;cache()}if(after)after();setSync(first?"5 minutes on "+q.label+". First: "+first:"Just 5 minutes on "+q.label+". You can stop after that.")}
    if(!commitOn()){go("");return}
    openG("Just 5 minutes?",function(b){
      var TL=activeDefs(todayKey()).filter(function(x){return x.type==="time"});
      b.innerHTML='<p class="mhead good">Low pressure. Just 5 minutes'+(TL.length>1?'':' on '+esc(q.label))+'.</p>'+(TL.length>1?'<label class="tpk">On which quest?<select id="j5Q">'+TL.map(function(x){var e1=S.days[todayKey()]||{};return '<option value="'+x.id+'"'+(x.id===q.id?" selected":"")+'>'+esc(x.label)+' ('+hm(e1[x.id]|0)+(x.roll?'':' of '+hm(x.min))+')'+(x.id===q.id?' \u2014 furthest behind':'')+'</option>'}).join("")+'</select></label>':'')+'<p class="help" style="margin-top:6px"></p><ul class="stakes soft"><li>That\u2019s the whole promise: <b>5 minutes</b>.</li><li>At 5 minutes you\u2019ll hear a chime. Stop guilt-free, or keep going if it\u2019s flowing.</li><li>No XP is lost either way. Starting is the win here.</li></ul><label class="tpk">The tiniest first action (optional)<input id="j5First" maxlength="80" placeholder="e.g. open the file and read one paragraph"></label><p class="help">Tip: put your phone face-down before you tap start.</p><div class="edrow end"><button type="button" class="stone" id="j5No">Not now</button><button type="button" class="stone save" id="j5Go">Start 5 minutes</button></div>';
      b.querySelector("#j5No").addEventListener("click",closeG);
      var qs=b.querySelector("#j5Q");if(qs)qs.addEventListener("change",function(){q=TL.filter(function(x){return x.id===qs.value})[0]||q});
      b.querySelector("#j5Go").addEventListener("click",function(){var f=b.querySelector("#j5First").value.trim();closeG();if(S.timer&&S.timer.id===q.id){setSync("Already running.");return}go(f)});
      var inp=b.querySelector("#j5First");inp.addEventListener("keydown",function(e){if(e.key==="Enter"){var f=inp.value.trim();closeG();go(f)}});
    });
  }
  function markDone(q){var T=todayKey();if(q.type==="todo"){toggleTodo(q);return}var e=entry();e[q.id]=true;commit()}
  var lastPick=null;
  function openPick(){if(locked())return;openG("Pick for me",function(b){
    function roll(){var P=pickPool();if(!P.length&&allTopics().some(function(o){return topicStats(o.t).due}))P=[];if(!P.length&&!allTopics().some(function(o){return topicStats(o.t).due})){b.innerHTML='<p class="mhead good">Nothing left to pick. Everything is done!</p><div class="edrow end"><button type="button" class="stone" id="pkC">Close</button></div>';b.querySelector("#pkC").addEventListener("click",closeG);return}
      var dueT=allTopics().filter(function(o){return topicStats(o.t).due});if(dueT.length&&(!P.length||Math.random()<.35)){var o=dueT[Math.floor(Math.random()*dueT.length)];lastPick=o.t.id;
        b.innerHTML='<p class="help">Due for review (not touched in 14+ days)</p><p class="mhead">'+esc(o.t.name)+'</p><p class="help">'+esc(o.sname)+'</p><div class="edrow end"><button type="button" class="stone" id="pkAgain">Another</button><button type="button" class="stone save" id="pkGo">Review for 5 minutes</button></div>';
        b.querySelector("#pkAgain").addEventListener("click",roll);b.querySelector("#pkGo").addEventListener("click",function(){closeG();start5(null,function(){if(S.timer){S.timer.topic=o.t.id;cache()}})});return}
      var pool=P.length>1?P.filter(function(q){return q.id!==lastPick}):P,q=pool[Math.floor(Math.random()*pool.length)];lastPick=q.id;
      var kind={time:"Time quest",check:"Daily habit",todo:"To-do",weekly:"Weekly goal",target:"Target"}[q.type]||"Quest";
      b.innerHTML='<p class="help">'+kind+'</p><p class="mhead">'+esc(q.label)+'</p><p class="help">'+esc(reqText(q))+'</p><div class="edrow end"><button type="button" class="stone" id="pkAgain">Another</button>'+(q.type==="time"?'<button type="button" class="stone save" id="pkGo">Start 5 minutes</button>':q.type==="target"?'<button type="button" class="stone save" id="pkGo">OK, on it</button>':'<button type="button" class="stone save" id="pkGo">Mark done</button>')+'</div>';
      b.querySelector("#pkAgain").addEventListener("click",roll);
      b.querySelector("#pkGo").addEventListener("click",function(){closeG();if(q.type==="time")start5(q);else if(q.type!=="target")markDone(q)});}
    roll()})}
  var batchT=0;
  function openBatch(){if(locked())return;var T=todayKey(),start=Date.now(),doneN=0;
    openG("Batch to-dos",function(b){
      function draw(){var e=S.days[T]||{},L=activeDefs(T).filter(function(q){return q.type==="todo"});
        if(!L.length){b.innerHTML='<p class="help">No to-dos today. Add some with the to-do box, then batch them here.</p><div class="edrow end"><button type="button" class="stone" id="btC">Close</button></div>';b.querySelector("#btC").addEventListener("click",closeG);return}
        b.innerHTML='<p class="help">Knock out small tasks back to back. One timer for the whole batch.</p><div class="sp-time" id="btTime">0:00</div><div class="mlist">'+L.map(function(q){var d=!!e[q.id];return '<div class="mrow'+(d?' ok':'')+'"><i class="mk"></i><span class="ml">'+esc(q.label)+'</span><button type="button" class="stone mini'+(d?' on':'')+'" data-bt="'+q.id+'">'+(d?'Done':'Mark done')+'</button></div>'}).join("")+'</div><div class="edrow end"><button type="button" class="stone save" id="btEnd">Finish batch</button></div>';
        b.querySelectorAll("[data-bt]").forEach(function(x){x.addEventListener("click",function(){var q=L.filter(function(z){return z.id===x.getAttribute("data-bt")})[0];if(!q)return;var was=!!(S.days[T]||{})[q.id];toggleTodo(q);doneN+=was?-1:1;draw()})});
        b.querySelector("#btEnd").addEventListener("click",function(){closeG()});
        tick()}
      function tick(){var el=b.querySelector("#btTime");if(el)el.textContent=spFmt(Date.now()-start)}
      clearInterval(batchT);batchT=setInterval(tick,1000);draw();
    },function(){clearInterval(batchT);var m=Math.round((Date.now()-start)/60000);if(doneN>0)setSync("Batch: "+doneN+" to-do"+(doneN===1?"":"s")+" cleared in "+(m<1?"under a minute":hm(m))+".")})}
