  var START_KEY,START_AT;
  (function(){var st=null;try{st=(JSON.parse(localStorage.getItem("pc-cache-v1")||"{}").cfg||{}).start}catch(e){}
    if(!st){var n=new Date();st=new Date(n.getFullYear(),n.getMonth(),n.getDate()).toISOString()}setStart(st)})();
  function setStart(st){START_AT=new Date(st);START_KEY=START_AT.getFullYear()+"-"+String(START_AT.getMonth()+1).padStart(2,"0")+"-"+String(START_AT.getDate()).padStart(2,"0")}
  var D=JSON.parse(document.getElementById("achData").textContent);
  var LEGACY=[];
  var MIN=15,STEP=10,MAXM=960;
  var RANKS=[[0,"Apprentice","sprout"],[7,"Journeyman","sprout"],[21,"Session Player","flame"],[42,"Bandleader","metronome"],[90,"Virtuoso","dumbbell"],[180,"Master","trophy"],[365,"Maestro","star"]];
  var S={days:{},refl:{},cfg:null},db=null,uid=null,dl=null,dlChecked=false,view="today",dirty={},timer=null;
  /* Data schema. Bump SCHEMA and add a step to migrate() whenever the stored shape changes. */
  var SCHEMA=3;
  function migrate(c){c=c||{};var v=c.schema||2;
    if(v<3){if(c.cfg){delete c.cfg.bank;delete c.cfg.commitCheck}v=3}
    c.schema=v;return c}
  try{var c=migrate(JSON.parse(localStorage.getItem("pc-cache-v1")||"{}"));S.days=c.days||{};S.refl=c.refl||{};S.cfg=c.cfg||null;S.timer=c.timer||null;S.sprint=c.sprint||null;if(c.spLen)S.spLen=c.spLen;if(c.spRounds!=null)S.spRounds=c.spRounds;if(c.spLongOn===false)S.spLongOn=false}catch(e){}
  function cache(){try{S.schema=SCHEMA;localStorage.setItem("pc-cache-v1",JSON.stringify(S))}catch(e){}}
  function key(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function parse(k){var p=k.split("-");return new Date(+p[0],p[1]-1,+p[2])}
  function add(k,n){var d=parse(k);d.setDate(d.getDate()+n);return key(d)}
  function dayEnd(){return (S.cfg&&S.cfg.dayEnd)|0}
  function todayKey(){var d=new Date();d.setHours(d.getHours()-dayEnd());return key(d)}
  function mins(t){var p=String(t).split(":");return (+p[0])*60+(+p[1])}
  function clone(x){return JSON.parse(JSON.stringify(x))}
  function cfg(){if(!S.cfg){S.cfg={quests:[],rules:null,start:START_AT.toISOString(),updated:""};cache()}if(!S.cfg.start)S.cfg.start=START_AT.toISOString();return S.cfg}
  function isPaused(q,k){return !!q.pausedUntil&&k<q.pausedUntil&&(!q.pausedFrom||k>=q.pausedFrom)}
  function slim(q){var o={id:q.id,type:q.type,label:q.label};["min","max","from","to","unit","note","days","opt","ul","step","scale","total","due","roll","dl","subj","topic","fin","lock","pending"].forEach(function(f){if(q[f]!=null&&q[f]!=="")o[f]=q[f]});return o}
  function scheduled(q,k){return !q.days||!q.days.length||q.days.indexOf(parse(k).getDay())>=0}
  function activeDefs(k){var vc=isVac(k),c0=cfg(),LD=(c0.lockDay&&c0.lockDay.date===k)?c0.lockDay.defs:null,src=c0.quests.map(function(q){return LD&&LD[q.id]?LD[q.id]:q});if(LD)Object.keys(LD).forEach(function(id){if(!c0.quests.some(function(q){return q.id===id}))src.push(LD[id])});return src.filter(function(q){if(q.completed&&q.completed.on<k)return false;if(q.type==="todo")return !q.doneOn||q.doneOn===k;if(q.dl&&(k>q.dl.due||k<q.dl.from))return false;return !isPaused(q,k)&&scheduled(q,k)}).map(function(q){var o=slim(q);if(q.dl){o.min=dlMin(q,k);if(!o.min)o.opt=true}if(vc)o.opt=true;return o})}
  function reqOf(d){return d.filter(function(q){return !q.opt&&q.type!=="weekly"&&q.type!=="todo"})}
  function reqDefsFor(k){if(isVac(k))return [];var e=S.days[k];return reqOf((e&&e.q)?e.q:(hasEntry(e)?LEGACY:activeDefs(k)))}
  function num(v){return Math.round((+v||0)*100)/100}
  function projSum(id,upto){var t=0;Object.keys(S.days).forEach(function(k){if(!upto||k<=upto)t+=+((S.days[k]||{})[id])||0});return num(t)}
  function hasEntry(e){return !!e&&Object.keys(e).some(function(f){if(f==="top")return (e.top||[]).some(function(x){return x&&x.t});return f!=="q"&&f!=="ended"&&f!=="endedAt"&&f.indexOf("plan_")!==0&&e[f]!==""&&e[f]!=null&&e[f]!==0&&e[f]!==false})}
  function defsOf(e){return (e&&e.q)||(hasEntry(e)?LEGACY:activeDefs(todayKey()))}
  function metQ(q,e){e=e||{};var v=e[q.id];if(q.type==="wake"){if(!v)return q.id==="wakeAt"&&e.wake===true;var m=mins(v);return m>=mins(q.from)&&m<=mins(q.to)}if(q.type==="time")return timeMet(q,e);if(q.type==="limit")return (v|0)<=q.max;if(q.type==="check"||q.type==="weekly"||q.type==="todo")return v===true;if(q.type==="target")return num(v)>=q.min;if(q.type==="scale")return (v|0)>=q.min;return false}
  function overQ(q,e){return q.type==="limit"&&((e||{})[q.id]|0)>q.max}
  function planOf(q,e){return Math.max(q.min,(e||{})["plan_"+q.id]||q.min)}
  function ok(e){if(!hasEntry(e))return false;var dq=reqOf(defsOf(e));return dq.length>0&&dq.every(function(q){return metQ(q,e)})}
  function limBroken(e){return !!e&&reqOf(defsOf(e)).some(function(q){return overQ(q,e)})}
  function gold(e){return ok(e)&&reqOf(defsOf(e)).every(function(q){return q.type!=="time"||q.roll||(e[q.id]|0)>=planOf(q,e)})}
  function dayXP(e){if(!e)return 0;var x=0;defsOf(e).forEach(function(q){if(q.type!=="time"){if(metQ(q,e)&&q.type!=="limit"&&q.type!=="wake"&&hasEntry(e))x+=q.opt?10:20;return}var d=Math.min(240,e[q.id]|0);x+=d;if(d>0&&d>=planOf(q,e))x+=30});x+=(e.sess||[]).filter(function(z){return z.m>=90}).length*25;x-=(e.brk||0)*BREAK_XP;x+=(e.top||[]).filter(function(t){return t&&t.t&&t.d}).length*5;if(ok(e))x+=50;if(gold(e))x+=100;return Math.max(0,x)}
  function weekStart(k){return add(k,-((parse(k).getDay()+6)%7))}
  function weekCount(id,k,upto){var s0=weekStart(k),n=0;for(var i=0;i<7;i++){var d=add(s0,i);if(upto&&d>k)break;if((S.days[d]||{})[id]===true)n++}return n}
  function totalXP(){var t=todayKey(),x=completionXP();Object.keys(S.days).forEach(function(k){if(k>=START_KEY&&k<=t){var e=S.days[k];x+=dayXP(e);if(e)defsOf(e).forEach(function(q){if(q.type==="weekly"&&e[q.id]===true&&weekCount(q.id,k,true)===q.min)x+=100})}});return x}
  function level(x){var l=1,need=300;while(x>=need){x-=need;l++;need=300*l}return{l:l,cur:x,need:need}}
