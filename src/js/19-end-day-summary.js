  /* 1. end day summary */
  function endToday(){if(S.timer)stopTimer();if(S.sprint&&S.sprint.phase!=="done")spFinish(true);var k=todayKey();S.days[k]=Object.assign({},S.days[k]||{},{ended:true,endedAt:new Date().toISOString(),q:activeDefs(k)});dirty[k]=true;cache();render();clearTimeout(timer);timer=setTimeout(flush,300)}
  function openEndModal(){
    if(locked())return;var T=todayKey(),e=S.days[T]||{},defs=activeDefs(T),req=reqOf(defs),miss=req.filter(function(q){return !metQ(q,e)}),isOk=hasEntry(e)&&req.length&&!miss.length;
    openG("End today?",function(b){
      var h='<p class="mhead '+(isOk?"good":req.length?"bad":"")+'">'+(isOk?(gold(e)?"Gold day! Every quest met its plan.":"Day cleared! All "+req.length+" quests done."):req.length?miss.length+" of "+req.length+" quests still open.":"Rest day: nothing required.")+'</p>';
      if(miss.length)h+='<p class="help">Still open: '+miss.map(function(q){return esc(q.label)}).join(", ")+'.</p>';
      var tp=[];if(tp.length)h+='<p class="help">Top 3: '+tp.filter(function(x){return x.d}).length+' of '+tp.length+' done.</p>';
      h+=qList(e,defs)+'<p class="help">Ending locks today for good. You can download today\u2019s wrap-up right after.</p><div class="edrow end"><button type="button" class="stone" id="emNo">Keep going</button><button type="button" class="stone del" id="emYes">End day</button></div>';
      b.innerHTML=h;b.querySelector("#emNo").addEventListener("click",closeG);b.querySelector("#emYes").addEventListener("click",function(){closeG();endToday();setTimeout(openEndedModal,0)});
    });
  }
  function openEndedModal(){var T=todayKey();openG("Day ended",function(b){var e=S.days[T]||{};b.innerHTML='<p class="mhead '+(ok(e)?"good":"")+'">'+(ok(e)?(gold(e)?"Gold day locked in.":"Day cleared and locked in."):"Today is locked.")+'</p><p class="help">Download your wrap-up now, or any time later by tapping today\u2019s square in the strip.</p><div class="edrow end"><button type="button" class="stone" id="edClose">Close</button><button type="button" class="stone save" id="edWrap">Download wrap-up</button></div>';b.querySelector("#edClose").addEventListener("click",closeG);var wb=b.querySelector("#edWrap");wb.addEventListener("click",function(){doWrap(T,wb)})},function(){setTimeout(function(){reviewTodos("endday")},150)})}
