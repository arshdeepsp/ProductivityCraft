  /* ---- per-quest change rules (flexible / fortnight lock / free) ---- */
  var LOCKS=[["flex","Flexible","Weekly easing budget (3/week), changes start tomorrow"],["fortnight","Locked for a fortnight","Easing changes are scheduled for the end of each 14-day cycle"],["free","Free","No limits, for quests you\u2019re still trying out"]];
  function lockOf(q){return strictOn()?(q.lock||"flex"):"flex"}
  function cycleDue(q,T){var st=q.lockFrom||T,n=Math.floor(daysBetween(st,T)/14)+1;return add(st,14*n)}
  function pendText(p){return p.op==="delete"?"Delete":p.op==="pause"?"Pause":p.op==="complete"?"Complete":"Changes"}
  function queueChange(id,op,newQ){var c=clone(cfg()),q=c.quests.filter(function(x){return x.id===id})[0];if(!q)return null;var due=cycleDue(q,todayKey());q.pending={op:op,due:due};if(newQ){var nq=clone(newQ);delete nq.pending;q.pending.q=nq}saveCfg(c);qSig="";return due}
  /* Quests with every pending change due by day T applied (on its due date). Also used to snapshot days the app wasn't opened. */
  function pendingApplied(Q,T){var out=[];Q.forEach(function(q){var p=q.pending;if(!p||p.due>T){out.push(q);return}var D=p.due;
      if(p.op==="delete")return;if(p.op==="pause"){delete q.pending;q.pausedFrom=D;q.pausedUntil=nextMonday(D);out.push(q);return}if(p.op==="complete"){delete q.pending;q.completed={on:D,how:"manual"};out.push(q);return}
      var nq=Object.assign({},p.q||q);delete nq.pending;nq.id=q.id;if(nq.lock&&nq.lock!==q.lock)nq.lockFrom=D;out.push(nq)});return out}
  function applyPending(){var T=todayKey(),c=clone(cfg());if(!c.quests.some(function(q){return q.pending&&q.pending.due<=T}))return;c.quests=pendingApplied(c.quests,T);saveCfg(c);qSig="";setSync("Scheduled quest changes applied")}
  function cancelPending(id){var c=clone(cfg()),q=c.quests.filter(function(x){return x.id===id})[0];if(!q||!q.pending)return;delete q.pending;saveCfg(c);qSig="";render();setSync("Scheduled change cancelled")}
