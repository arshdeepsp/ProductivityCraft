  /* ---- trends ---- */
  function svgBars(vals,labs,mx,col,fmt){var W=560,H=170,n=vals.length,bw=Math.floor((W-20)/n)-6,o='<svg viewBox="0 0 '+W+' '+(H+34)+'" class="tchart" role="img" shape-rendering="crispEdges">';o+='<rect x="0" y="'+H+'" width="'+W+'" height="3" fill="#555"/>';
    vals.forEach(function(v,i){var h=mx?Math.round(v/mx*(H-24)):0,x=10+i*(bw+6);o+='<rect x="'+x+'" y="'+(H-h)+'" width="'+bw+'" height="'+h+'" fill="'+col+'"/>';if(v)o+='<text x="'+(x+bw/2)+'" y="'+(H-h-6)+'" text-anchor="middle" class="tv">'+fmt(v)+'</text>';o+='<text x="'+(x+bw/2)+'" y="'+(H+24)+'" text-anchor="middle" class="tl">'+labs[i]+'</text>'});return o+'</svg>'}
  function renderTrends(){
    var el=document.getElementById("trendsBody");if(!el)return;var T=todayKey(),st=lastSt||compute(),ws0=weekStart(T);
    function focusOf(d){var e=S.days[d]||{},m=0;defsOf(e).forEach(function(q){if(q.type==="time")m+=e[q.id]|0});return m}
    function span(a,b){var s=0;for(var d=a;d<=b;d=add(d,1))if(d>=START_KEY)s+=focusOf(d);return s}
    var nIn=daysBetween(ws0,T),thisW=span(ws0,T),lastW=span(add(ws0,-7),add(ws0,-7+nIn)),dW=thisW-lastW;
    var clr=0,dIn=0,qDone=0,qAll=0,deep=0;for(var d=ws0;d<=T;d=add(d,1)){if(d<START_KEY)continue;dIn++;if(st.marks[d]==="ok")clr++;var e=S.days[d]||{};var rq=reqOf(defsOf(e));if(hasEntry(e)||d===T){qAll+=rq.length;qDone+=rq.filter(function(q){return metQ(q,e)}).length}deep+=(e.sess||[]).filter(function(z){return z.m>=90}).length}
    var gold30=0,bestDay=0,bestDayK=null,longest=0;Object.keys(S.days).forEach(function(k){if(k<START_KEY||k>T)return;var e=S.days[k];if(k>=add(T,-29)&&gold(e))gold30++;var f=focusOf(k);if(f>bestDay){bestDay=f;bestDayK=k}(e.sess||[]).forEach(function(z){if(z.m>longest)longest=z.m})});
    var wk=[],labs=[],bestWeek=0;for(var i=7;i>=0;i--){var ws=add(ws0,-7*i);wk.push(ws);labs.push(parse(ws).toLocaleDateString("en-CA",{month:"short",day:"numeric"}));var wf=span(ws,add(ws,6));if(wf>bestWeek)bestWeek=wf}
    var cleared=wk.map(function(ws){var n=0;for(var j=0;j<7;j++){var dd=add(ws,j);if(st.marks[dd]==="ok")n++}return n});
    var done=cfg().quests.filter(function(q){return q.completed&&q.completed.how!=="archived"}).length,pct=qAll?Math.round(qDone/qAll*100):0;
    function tile(col,icon,label,big,sub,cls){return '<div class="ttile" style="--tc:'+col+'"><div class="tt-i">'+svg(icon)+'</div><div class="tt-b"><div class="tt-l">'+label+'</div><div class="tt-v">'+big+'</div>'+(sub?'<div class="tt-s '+(cls||'')+'">'+sub+'</div>':'')+'</div></div>'}
    var h='<div class="tsec"><div class="tsec-h">This week</div><div class="tgrid">'+
      tile("#3C8527","flame","Focus time",hm(thisW),(dW===0?"Same as last week":(dW>0?"\u25b2 "+hm(dW):"\u25bc "+hm(-dW))+" vs last week"),dW>0?"up":dW<0?"dn":"")+
      tile("#2C6FB0","metronome","Days cleared",clr+"/"+Math.max(1,dIn),clr===dIn&&dIn?"Perfect so far!":"Streak "+st.streak+"d")+
      tile("#B8860B","star","Quests done",pct+"%",qDone+" of "+qAll+" required")+
      tile("#8A3A9E","dumbbell","Deep sessions",deep,"90+ min unbroken")+
      '</div></div>';
    h+='<div class="tsec"><div class="tsec-h">Records</div><div class="tgrid five">'+
      tile("#C0392B","trophy","Best focus day",hm(bestDay),bestDayK?fmtD(bestDayK):"\u2014")+
      tile("#16A085","note","Longest session",longest?hm(longest):"\u2014",longest>=90?"Deep work!":"")+
      tile("#D35400","sprout","Best week",hm(bestWeek),"last 8 weeks")+
      tile("#C99A1E","star","Gold days",gold30,"last 30 days")+
      tile("#5D6D7E","trophy","Quests finished",done,"all time")+
      '</div></div>';
    h+='<div class="tsec"><div class="tsec-h">Charts</div><div class="tcharts"><div class="trcard"><div class="sh2">Focus time, last 14 days</div>';
    var daysL=[],dl=[];for(var k2=13;k2>=0;k2--){var d2=add(T,-k2);daysL.push(d2<START_KEY?0:focusOf(d2));dl.push(parse(d2).toLocaleDateString("en-CA",{weekday:"narrow"}))}
    h+=svgBars(daysL,dl,Math.max(60,...daysL),"#FFD23F",function(v){return v>=60?Math.round(v/60*10)/10+"h":v+"m"})+'</div><div class="trcard"><div class="sh2">Days cleared per week</div>'+svgBars(cleared,labs,7,"#7FE05A",function(v){return v})+'</div></div></div>';
    var SL=subjList();
    h+='<div class="tsec"><div class="tsec-h">Subjects</div>'+(SL.length?'<div class="tgrid subjt">'+SL.map(function(s,i){var tp=s.topics||[],av=avgProf(s),lv=Math.round(av),start=tp.length?tp.reduce(function(a,t){return a+((t.hist&&t.hist.length)?t.hist[0].p:(t.p||0))},0)/tp.length:0,gr=av-start,due=tp.filter(function(t){return topicStats(t).due}).length,mins=subjMinutes(s.id)+tp.reduce(function(a,t){return a+topicStats(t).tot},0),cols=["#2C6FB0","#8A3A9E","#16A085","#D35400","#C0392B","#B8860B"];
      return '<div class="sjt" style="--tc:'+cols[i%cols.length]+'"><div class="sjt-h"><b>'+esc(s.name)+'</b><span class="lvbadge">'+(tp.length?LV[Math.max(1,lv)]:"No topics")+'</span></div><div class="xpbar2"><i style="width:'+Math.round(av/5*100)+'%"></i></div><div class="sjt-r"><span>'+hm(mins)+' studied</span><span>'+tp.length+' topic'+(tp.length===1?'':'s')+'</span>'+(gr>0.05?'<span class="up">\u25b2 '+(Math.round(gr*10)/10)+' level'+(Math.round(gr*10)/10===1?'':'s')+' since start</span>':'')+(due?'<span class="dn">'+due+' due for review</span>':'')+'</div></div>'}).join("")+'</div>':'<p class="help light">Add subjects to see their progress here.</p>')+'</div>';
    el.innerHTML=h;
  }

