  /* ---- momentum: bank, rolling targets, sessions ---- */
  var eKey=new WeakMap(),bankCov=new WeakMap(),bankNow={};
  function buildBank(){
    eKey=new WeakMap();bankCov=new WeakMap();bankNow={};var on=false,bal={},T=todayKey();
    Object.keys(S.days).sort().forEach(function(k){var e=S.days[k];if(!e)return;eKey.set(e,k);if(!on||k<START_KEY||k>T)return;var cov={};
      defsOf(e).forEach(function(q){if(q.type!=="time"||q.roll)return;var v=e[q.id]|0,b=bal[q.id]||0;
        if(v>=q.min){if(k<T)bal[q.id]=Math.min(q.min,b+(v-q.min))}
        else{var c=Math.min(b,q.min-v,Math.floor(q.min/2));if(c>0&&v>0){cov[q.id]=c;if(k<T)bal[q.id]=b-c}}});
      bankCov.set(e,cov)});
    bankNow=bal;
  }
  function carriedOK(k){return false}
  function carriedOKOld(k){var rq=reqDefsFor(k);if(!rq.length)return false;var anyRoll=false;for(var i=0;i<rq.length;i++){var q=rq[i];if(q.type==="limit")continue;if(q.type==="time"&&q.roll){anyRoll=true;if(rollSum(q.id,k,q)<rollNeed(q,k))return false;continue}return false}return anyRoll}
  function rollOnlyDay(k){var rq=reqDefsFor(k).filter(function(q){return q.type!=="limit"});return rq.length&&rq.every(function(q){return q.type==="time"&&q.roll})?rq:null}
  function emptyCover(fromK){return null}
  function emptyCoverOld(fromK){var rq=rollOnlyDay(fromK);if(!rq)return null;var best=99;rq.forEach(function(q){var n=0,ws=perStart(q,fromK),s=0;for(var dd=ws;dd<fromK;dd=add(dd,1))s+=(S.days[dd]||{})[q.id]|0;for(var d=0;d<31;d++){var k=add(fromK,d);if(perStart(q,k)!==ws)break;if(s>=rollNeed(q,k))n++;else break}best=Math.min(best,n)});return best}
  /* Time totals run over a period: the calendar week (default), two weeks (q.per "2w", counted from the week the
     quest started) or the calendar month (q.per "month"). Pace spreads the total across the period's work days. */
  var PER_NAME={"":"week","2w":"2 weeks",month:"month"};
  function perOf(q){return q&&(q.per==="2w"||q.per==="month")?q.per:""}
  function perStart(q,k){var p=perOf(q);if(p==="month")return k.slice(0,8)+"01";var ws=weekStart(k);if(p==="2w"){var n=Math.round(daysBetween(weekStart(rollFrom(q)),ws)/7);if(((n%2)+2)%2===1)ws=add(ws,-7)}return ws}
  function perEnd(q,k){var p=perOf(q),s=perStart(q,k);if(p==="month"){var d=parse(s);return key(new Date(d.getFullYear(),d.getMonth()+1,0))}return add(s,p==="2w"?13:6)}
  function perWorkDays(q,k){var n=0;for(var d=perStart(q,k),e=perEnd(q,k);d<=e;d=add(d,1))if(scheduled(q,d))n++;return n||1}
  function perWord(q){return PER_NAME[perOf(q)]}
  function cfgQ(id){return cfg().quests.filter(function(q){return q.id===id})[0]}
  function rollSum(id,k,q){q=q||cfgQ(id);var s=0,ws=q?perStart(q,k):weekStart(k);for(var d=ws;d<=k;d=add(d,1)){if(d<START_KEY)continue;s+=(S.days[d]||{})[id]|0}return s}
  function weekFrom(q,k){var ws=perStart(q,k),f=rollFrom(q);return f>ws?f:ws}
  /* Past days are frozen: lockPast() gives every passed day a snapshot of its quests (e.q, if it has none) and its
     halfway checkpoints (e.ck = quest ids whose checkpoint fell on it), as they stood when the day ended. Later edits,
     pauses or deletions then never rewrite history. dayDefMap(d) = quests on day d: the snapshot for past days, the
     live settings for today and later. */
  var lockedThru=null,lockDays=null,ddm={},ddmKey="";
  function lockPast(){if(!S.cfg)return;if(lockDays!==S.days){lockDays=S.days;lockedThru=null}var T=todayKey(),d=lockedThru?add(lockedThru,1):START_KEY,ch=false;
    for(;d<T;d=add(d,1)){var e=S.days[d];if(e&&e.ck)continue;if(!e||(!e.q&&!hasEntry(e))){e=S.days[d]=Object.assign({},e||{});e.q=activeDefs(d)}else e=S.days[d]=Object.assign({},e);ddm={};e.ck=[];
      (e.q||[]).forEach(function(q){if(q.type==="time"&&q.roll&&midAt(q,d,d)===d)e.ck.push(q.id)});ch=true}
    if(d>=T)lockedThru=add(T,-1);if(ch){ddm={};cache()}}
  function dayDefMap(d){var T=todayKey(),kk=T+"|"+(S.cfg&&S.cfg.updated);if(kk!==ddmKey||ddm.__c!==S.cfg||ddm.__d!==S.days){ddm={__c:S.cfg,__d:S.days};ddmKey=kk}if(ddm[d])return ddm[d];
    var e=S.days[d],L=d<T&&e&&e.q?e.q:activeDefs(d),m={};L.forEach(function(q){m[q.id]=q});return (ddm[d]=m)}
  /* A work day for a total: it's on that day's list, not an off day, not on vacation (a paused day isn't on the list). */
  function workOn(q,d){var x=dayDefMap(d)[q.id];return !!x&&!x.off&&scheduled(x,d)&&!isVac(d)}
  function workDaysIn(q,a,b){var n=0;for(var d=a;d<=b;d=add(d,1))if(workOn(q,d))n++;return n}
  /* Halfway checkpoint: the ceil(n/2)-th work day of the period (from the quest's start in a first period). By the end
     of it you need half the period's target, so work can't all pile up at the end. Once a day has passed with the
     checkpoint on it, that's fixed (e.ck); if a later change would move it onto a day already gone, it's today. */
  function midAt(q,k,now){var f=weekFrom(q,k),e=perEnd(q,k),L=[];for(var d=f;d<=e;d=add(d,1)){if(d<now){var x=S.days[d];if(x&&x.ck&&x.ck.indexOf(q.id)>=0)return d}if(workOn(q,d))L.push(d)}
    if(!L.length)return null;var m=L[Math.ceil(L.length/2)-1];return m<now?(now<=e?now:null):m}
  function midDay(q,k){return midAt(q,k,todayKey())}
  function midNeed(q,k){return Math.round(weekTarget(q,k)/2)}
  /* Totals judged in the period around day k: every total on the list on any day of the period so far or still to
     come (so pausing it or deleting it doesn't skip the check), unless it's marked optional. Latest version wins. */
  function periodList(k){var C={},T=todayKey();cfg().quests.forEach(function(q){if(q.type==="time"&&q.roll)C[q.id]=q});for(var d=add(k,-31);d<k;d=add(d,1)){var e=S.days[d];((e&&e.q)||[]).forEach(function(q){if(q.type==="time"&&q.roll&&!C[q.id])C[q.id]=q})}
    var out=[];Object.keys(C).forEach(function(id){var q0=C[id],last=null,uo=false;for(var d=perStart(q0,k),e=perEnd(q0,k);d<=e;d=add(d,1)){var x=dayDefMap(d)[id];if(!x)continue;last=x;if(!isVac(d))uo=!!x.opt&&!x.off}
      if(last&&!uo)out.push(slim(cfgQ(id)||last))});return out}
  function weekWorkDays(q){return q.days&&q.days.length?q.days.length:7}
  function weekTarget(q,k){var f=weekFrom(q,k);return Math.round(q.roll*workDaysIn(q,f,perEnd(q,k))/perWorkDays(q,k))}
  var firstSeenCache={},firstSeenSig="";
  function firstSeen(id){var sig=Object.keys(S.days).length+"";if(sig!==firstSeenSig){firstSeenCache={};firstSeenSig=sig}if(id in firstSeenCache)return firstSeenCache[id];var best=null;Object.keys(S.days).forEach(function(d){if(best&&d>=best)return;var e=S.days[d];if(e&&(hasEntry(e)||!e.ck)&&defsOf(e).some(function(q){return q.id===id}))best=d});return (firstSeenCache[id]=best)}
  function rollFrom(q){var f=q.startOn||q.addedOn||firstSeen(q.id)||START_KEY;return f>START_KEY?f:START_KEY}
  /* Pace needed by the end of day k: the straight-line share (so a surplus covers later empty days), but if you're
     behind, the shortfall is spread over the period's remaining work days instead of landing on the next one. */
  function rollNeed(q,k){var lin=Math.round(q.roll*workDaysIn(q,weekFrom(q,k),k)/perWorkDays(q,k)),before=rollSum(q.id,k,q)-((S.days[k]||{})[q.id]|0);
    if(!scheduled(q,k))return Math.min(lin,before);var left=workDaysIn(q,k,perEnd(q,k));if(left<1)return lin;return Math.min(lin,Math.round(before+Math.max(0,weekTarget(q,k)-before)/left))}
  function timeMet(q,e){var v=e[q.id]|0;if(q.roll){var k=eKey.get(e);if(!k)return false;return rollSum(q.id,k,q)>=rollNeed(q,k)}var c=(bankCov.get(e)||{})[q.id]||0;return v+c>=q.min}
  function addSession(T,id,start,end){var e=Object.assign({},S.days[T]||{}),ss=(e.sess||[]).slice(),m=Math.round((end-start)/60000);if(m<1)return;var last=ss[ss.length-1];
    if(last&&last.id===id&&start-last.e<120000){last=Object.assign({},last,{e:end,m:last.m+m});ss[ss.length-1]=last}else ss.push({id:id,s:start,e:end,m:m});e.sess=ss;S.days[T]=e;dirty[T]=true;cache()}
  function heat(){var T=todayKey(),now=Date.now(),h=0,hr=(S.days[T]||{}).heatReset||0;((S.days[T]||{}).sess||[]).forEach(function(s){if(s.e<=hr)return;var age=Math.max(0,(now-s.e)/60000);h+=s.m*Math.exp(-age/90)});
    if(S.timer)h+=(now-S.timer.start)/60000;if(S.sprint&&S.sprint.phase==="focus"&&!S.sprint.paused)h+=(now-S.sprint.start)/60000;return Math.min(180,h)}
