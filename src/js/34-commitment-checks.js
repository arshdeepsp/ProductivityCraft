  /* ---- commitment checks ---- */
  var COMMIT_MIN=25,BREAK_XP=15;
  function strictOn(){return !!(S.cfg&&S.cfg.strict)}
  function commitOn(){return strictOn()&&!rewardsOff()}
  function first0(f){return f&&typeof f==="string"?f:null}
  function confirmCommit(kind,info,go){
    if(!commitOn()){go("");return}
    var stakes=kind==="sprint"?'<li>Each block is a promise: <b>'+hm(info.len)+'</b> on one quest, no switching.</li><li>Stopping a block early marks it <b>broken</b>: <b>\u2212'+BREAK_XP+' XP</b> and your momentum drops to Cold.</li><li>Breaks are 15 minutes and can\u2019t be skipped, so plan around them.</li>'
      :'<li>Commit to at least <b>'+COMMIT_MIN+' minutes</b> on <b>'+esc(info.label)+'</b>.</li><li>Stopping before that marks an <b>early stop</b>: <b>\u2212'+BREAK_XP+' XP</b>, your momentum resets to Cold, and the wrap-up will show it.</li><li>The minutes you do put in still count toward the quest.</li>';
    openG(kind==="sprint"?"Commit to this sprint?":"Commit to this timer?",function(b){
      b.innerHTML='<p class="mhead bad">Beware: starting is a promise.</p><ul class="stakes">'+stakes+'</ul><p class="sh2">Before you start</p><div class="prep">'+["Phone on silent and out of reach","Water, snack and bathroom sorted","Only the tabs and materials you need are open","You know exactly what you\u2019re doing first"].map(function(t,i){return '<label class="pc"><input type="checkbox" data-pc="'+i+'"><span>'+t+'</span></label>'}).join("")+'</div><label class="tpk">Your first step (optional)<input id="ccFirst" maxlength="80" placeholder="e.g. re-read section 2.3, then outline"></label><p class="help" id="ccHint">Tick what\u2019s ready. Unticked items are worth fixing first.</p><div class="edrow end"><button type="button" class="stone" id="ccNo">Not yet</button><button type="button" class="stone save" id="ccGo">I commit, start</button></div>';
      var hint=b.querySelector("#ccHint"),boxes=b.querySelectorAll("[data-pc]");
      function upd(){var n=[].filter.call(boxes,function(x){return x.checked}).length;hint.textContent=n===boxes.length?"All set. Good luck.":(boxes.length-n)+" item"+(boxes.length-n===1?"":"s")+" not ready. Fixing them now makes it easier to keep the promise.";hint.className="help"+(n===boxes.length?" okc":"")}
      boxes.forEach(function(x){x.addEventListener("change",upd)});
      b.querySelector("#ccNo").addEventListener("click",function(){closeG();setSync("Take a minute to prepare, then start when ready.")});
      b.querySelector("#ccGo").addEventListener("click",function(){var f=b.querySelector("#ccFirst").value.trim();closeG();go(f)});
    });
  }
  function markBroken(T,why){if(rewardsOff())return;var e=Object.assign({},S.days[T]||{});e.brk=(e.brk||0)+1;e.heatReset=Date.now();S.days[T]=e;dirty[T]=true;cache();clearTimeout(timer);timer=setTimeout(flush,300);sfx("fail");render();setSync(why+": \u2212"+BREAK_XP+" XP, momentum reset.")}
