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
  function emptyCover(fromK){var rq=rollOnlyDay(fromK);if(!rq)return null;var best=99;rq.forEach(function(q){var n=0;for(var d=0;d<14;d++){var k=add(fromK,d),s=0;for(var i=0;i<7;i++){var dd=add(k,-i);if(dd<START_KEY)break;if(dd>=fromK)continue;s+=(S.days[dd]||{})[q.id]|0}if(s>=rollNeed(q,k))n++;else break}best=Math.min(best,n)});return best}
  function rollSum(id,k){var s=0;for(var i=0;i<7;i++){var d=add(k,-i);if(d<START_KEY)break;s+=(S.days[d]||{})[id]|0}return s}
  function rollNeed(q,k){var n=Math.min(7,daysBetween(START_KEY,k)+1);return Math.round(q.roll*n/7)}
  function timeMet(q,e){var v=e[q.id]|0;if(q.roll){var k=eKey.get(e);if(!k)return false;return rollSum(q.id,k)>=rollNeed(q,k)}var c=(bankCov.get(e)||{})[q.id]||0;return v+c>=q.min}
  function addSession(T,id,start,end){var e=Object.assign({},S.days[T]||{}),ss=(e.sess||[]).slice(),m=Math.round((end-start)/60000);if(m<1)return;var last=ss[ss.length-1];
    if(last&&last.id===id&&start-last.e<120000){last=Object.assign({},last,{e:end,m:last.m+m});ss[ss.length-1]=last}else ss.push({id:id,s:start,e:end,m:m});e.sess=ss;S.days[T]=e;dirty[T]=true;cache()}
  function heat(){var T=todayKey(),now=Date.now(),h=0,hr=(S.days[T]||{}).heatReset||0;((S.days[T]||{}).sess||[]).forEach(function(s){if(s.e<=hr)return;var age=Math.max(0,(now-s.e)/60000);h+=s.m*Math.exp(-age/90)});
    if(S.timer)h+=(now-S.timer.start)/60000;if(S.sprint&&S.sprint.phase==="focus"&&!S.sprint.paused)h+=(now-S.sprint.start)/60000;return Math.min(180,h)}
