  /* ---- easing-change guard ---- */
  var EASE_BUDGET=3;
  function easeInfo(){var T=todayKey(),c=cfg(),setupEnd=add(START_KEY,7),setup=T<setupEnd,ws=weekStart(T),used=(c.easeLog||[]).filter(function(x){return x.date>=ws&&x.date<=T}).reduce(function(a,x){return a+(x.n||0)},0);return{T:T,setup:setup,setupEnd:setupEnd,used:used,left:Math.max(0,EASE_BUDGET-used)}}
  function allDays(q){return q.days&&q.days.length?q.days:[0,1,2,3,4,5,6]}
  function isEasier(o,n,T){
    if(n.type!==o.type)return true;if(!o.opt&&n.opt)return true;if(n.startOn&&n.startOn>(o.startOn||""))return true;var LR={free:0,flex:1,fortnight:2};if((LR[n.lock||"flex"])<(LR[o.lock||"flex"]))return true;
    if(n.pausedUntil&&n.pausedUntil!==o.pausedUntil&&isPaused(n,add(T,1)))return true;
    var nd=allDays(n);if(allDays(o).some(function(d){return nd.indexOf(d)<0}))return true;
    if((o.type==="time"||o.type==="target"||o.type==="weekly"||o.type==="scale")&&num(n.min)<num(o.min))return true;
    if(o.type==="scale"&&(n.scale||5)!==(o.scale||5))return true;
    if(o.type==="limit"&&(num(n.max)>num(o.max)||(n.unit||"")!==(o.unit||"")))return true;
    if(o.type==="wake"&&(n.from<o.from||n.to>o.to))return true;
    return false}
  function easedIds(oldQ,newQ,T){var nm={};newQ.forEach(function(q){nm[q.id]=q});var ids=[];oldQ.forEach(function(o){if(o.type==="todo")return;var n=nm[o.id];if(!n||isEasier(o,n,T))ids.push(o.id)});return ids}
  function guardEasing(c,oldQ,ids){
    var inf=easeInfo();if(inf.setup||!ids.length)return{ok:true,eased:0};
    if(strictOn()&&ids.length>inf.left)return{ok:false,msg:"That\u2019s "+ids.length+" easing change"+(ids.length===1?"":"s")+" (deleting, pausing, lowering a goal, raising a limit, making optional or removing days). You have "+inf.left+" of "+EASE_BUDGET+" left this week; it resets on Monday."};
    c.easeLog=(c.easeLog||[]).filter(function(x){return x.date>=add(inf.T,-60)}).concat([{date:inf.T,n:ids.length}]);
    var L=(c.lockDay&&c.lockDay.date===inf.T)?c.lockDay.defs:{};
    oldQ.forEach(function(o){if(ids.indexOf(o.id)>=0&&!L[o.id])L[o.id]=clone(o)});
    c.lockDay={date:inf.T,defs:L};
    return{ok:true,eased:ids.length,left:strictOn()?inf.left-ids.length:null};
  }
  function easeNote(){var inf=easeInfo();if(!strictOn())return "Changes that make a quest easier start tomorrow, so they can\u2019t rescue today.";return inf.setup?"Setup week: every change is free and immediate through "+fmtD(add(inf.setupEnd,-1))+".":"Easing changes left this week: "+inf.left+"/"+EASE_BUDGET+". They take effect tomorrow; adding or making quests harder is always free."}
