  /* ---- momentum: bank, rolling targets, sessions ---- */
  var eKey=new WeakMap(),bankCov=new WeakMap(),bankNow={};
  function buildBank(){
    eKey=new WeakMap();bankCov=new WeakMap();bankNow={};var on=false,bal={},T=todayKey();
    Object.keys(S.days).sort().forEach(function(k){var e=S.days[k];if(!e)return;eKey.set(e,k);if(!on||k<START_KEY||k>T)return;var cov={};
      defsOf(e).forEach(function(q){if(q.type!=="time"||q.roll)return;var v=e[q.id]|0,b=bal[q.id]||0;
        if(v>=q.min){if(k<T||e.ended)bal[q.id]=Math.min(q.min,b+(v-q.min))}
        else{var c=Math.min(b,q.min-v,Math.floor(q.min/2));if(c>0&&v>0){cov[q.id]=c;if(k<T||e.ended)bal[q.id]=b-c}}});
      bankCov.set(e,cov)});
    bankNow=bal;
  }
  function carriedOK(k){var rq=reqDefsFor(k);if(!rq.length)return false;var anyRoll=false;for(var i=0;i<rq.length;i++){var q=rq[i];if(q.type==="limit")continue;if(q.type==="time"&&q.roll){anyRoll=true;if(rollSum(q.id,k)<rollNeed(q,k))return false;continue}return false}return anyRoll}
  function rollOnlyDay(k){var rq=reqDefsFor(k).filter(function(q){return q.type!=="limit"});return rq.length&&rq.every(function(q){return q.type==="time"&&q.roll})?rq:null}
  function emptyCover(fromK){var rq=rollOnlyDay(fromK);if(!rq)return null;var best=99;rq.forEach(function(q){var n=0,ws=weekStart(fromK),s=0;for(var dd=ws;dd<fromK;dd=add(dd,1))s+=(S.days[dd]||{})[q.id]|0;for(var d=0;d<7;d++){var k=add(fromK,d);if(weekStart(k)!==ws)break;if(s>=rollNeed(q,k))n++;else break}best=Math.min(best,n)});return best}
  /* Weekly totals run on a fixed Mon–Sun week. */
  function rollSum(id,k){var s=0,ws=weekStart(k);for(var d=ws;d<=k;d=add(d,1)){if(d<START_KEY)continue;s+=(S.days[d]||{})[id]|0}return s}
  function weekFrom(q,k){var ws=weekStart(k),f=rollFrom(q);return f>ws?f:ws}
  function workDaysIn(q,a,b){var n=0;for(var d=a;d<=b;d=add(d,1))if(scheduled(q,d))n++;return n}
  function weekWorkDays(q){return q.days&&q.days.length?q.days.length:7}
  function weekTarget(q,k){var ws=weekStart(k),f=weekFrom(q,k);return Math.round(q.roll*workDaysIn(q,f,add(ws,6))/weekWorkDays(q))}
  var firstSeenCache={},firstSeenSig="";
  function firstSeen(id){var sig=Object.keys(S.days).length+"";if(sig!==firstSeenSig){firstSeenCache={};firstSeenSig=sig}if(id in firstSeenCache)return firstSeenCache[id];var best=null;Object.keys(S.days).forEach(function(d){if(best&&d>=best)return;var e=S.days[d];if(e&&defsOf(e).some(function(q){return q.id===id}))best=d});return (firstSeenCache[id]=best)}
  function rollFrom(q){var f=q.startOn||q.addedOn||firstSeen(q.id)||START_KEY;return f>START_KEY?f:START_KEY}
  function rollNeed(q,k){return Math.round(q.roll*workDaysIn(q,weekFrom(q,k),k)/weekWorkDays(q))}
  function timeMet(q,e){var v=e[q.id]|0;if(q.roll){var k=eKey.get(e);if(!k)return false;return rollSum(q.id,k)>=rollNeed(q,k)}var c=(bankCov.get(e)||{})[q.id]||0;return v+c>=q.min}
  function addSession(T,id,start,end){var e=Object.assign({},S.days[T]||{}),ss=(e.sess||[]).slice(),m=Math.round((end-start)/60000);if(m<1)return;var last=ss[ss.length-1];
    if(last&&last.id===id&&start-last.e<120000){last=Object.assign({},last,{e:end,m:last.m+m});ss[ss.length-1]=last}else ss.push({id:id,s:start,e:end,m:m});e.sess=ss;S.days[T]=e;dirty[T]=true;cache()}
  function heat(){var T=todayKey(),now=Date.now(),h=0,hr=(S.days[T]||{}).heatReset||0;((S.days[T]||{}).sess||[]).forEach(function(s){if(s.e<=hr)return;var age=Math.max(0,(now-s.e)/60000);h+=s.m*Math.exp(-age/90)});
    if(S.timer)h+=(now-S.timer.start)/60000;if(S.sprint&&S.sprint.phase==="focus"&&!S.sprint.paused)h+=(now-S.sprint.start)/60000;return Math.min(180,h)}
