  /* quest manager */
  var qmgr=document.getElementById("qmgr"),qDraft=null,mgrOpen=false;
  var mqOpenId=null,mgrSheet=document.getElementById("mgrSheet");document.getElementById("mgrBody").appendChild(qmgr);
  function openMgr(){if(ro())return;mgrOpen=true;mqOpenId=null;qDraft=clone(cfg().quests);drawMgr();qmgr.hidden=false;mgrSheet.hidden=false;document.body.classList.add("mgr-on");document.getElementById("mgrBody").scrollTop=0}
  function closeMgr(){mgrOpen=false;qmgr.hidden=true;mgrSheet.hidden=true;document.body.classList.remove("mgr-on");qDraft=null;render()}
  document.getElementById("mgrSaveTop").addEventListener("click",function(){var b=qmgr.querySelector("[data-msave]");if(b)b.click()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!mgrSheet.hidden&&document.getElementById("gModal").hidden){var b=qmgr.querySelector("[data-mcancel]");if(b)b.click();else closeMgr()}});
  document.getElementById("mgrCancelTop").addEventListener("click",function(){var b=qmgr.querySelector("[data-mcancel]");if(b)b.click();else closeMgr()});
  var TN={time:"Time",target:"Target",limit:"Limit",check:"Check",todo:"To-do",weekly:"Weekly",wake:"Clock time",scale:"Rating"};
  var LIB=[
    {label:"Wake up on time",type:"wake",from:"06:00",to:"07:30"},{label:"In bed on time",type:"wake",from:"21:00",to:"23:00",note:"log it when you get into bed"},
    {label:"Workout",type:"time",min:30},{label:"Study",type:"time",min:60},{label:"Read",type:"time",min:20},{label:"Practice an instrument",type:"time",min:30},{label:"Learn a language",type:"time",min:15},{label:"Meditate",type:"time",min:10},{label:"Deep work",type:"time",min:90},
    {label:"Steps",type:"target",min:8000,ul:"steps",step:500},{label:"Drink water",type:"target",min:8,ul:"glasses",step:1},{label:"Vegetables",type:"target",min:5,ul:"servings",step:1},{label:"Pages read",type:"target",min:20,ul:"pages",step:5},{label:"Distance",type:"target",min:5,ul:"km",step:0.5},
    {label:"Journal",type:"check"},{label:"Make the bed",type:"check"},{label:"Tidy up",type:"check"},{label:"Plan tomorrow",type:"check"},{label:"No alcohol",type:"check"},{label:"Call a friend or family",type:"check",opt:true},
    {label:"Screen time",type:"limit",max:120,unit:"min"},{label:"Social media",type:"limit",max:30,unit:"min"},{label:"Caffeine",type:"limit",max:2,ul:"cups"},{label:"Snacks",type:"limit",max:1,ul:"snacks"},{label:"Spending",type:"limit",max:20,ul:"$"},
    {label:"Mood",type:"scale",scale:5,min:3,opt:true},{label:"Energy",type:"scale",scale:5,min:3,opt:true},{label:"Focus",type:"scale",scale:10,min:6}
  ];
  function drawMgr(msg){
    var T=todayKey(),h='<div class="mgrtop"><div class="edrow end">'+(qDraft.some(function(q){return q.type==="todo"&&q.doneOn})?'<button type="button" class="stone" id="mgrTdClr">Clear done to-dos</button>':'')+(qDraft.length>1?'<button type="button" class="stone" id="mgrSort">Sort by type</button>':'')+(qDraft.length?'<button type="button" class="stone del" id="mgrClear">Clear all quests</button>':'')+'<button type="button" class="stone" data-mcancel>Cancel</button><button type="button" class="stone save" data-msave>Save quests</button></div><p class="help"><b>'+esc(easeNote())+'</b></p><p class="help">'+(endedT()?"Today is ended, so changes apply from tomorrow. ":"")+'Past days keep the quests they had. Optional quests earn XP but never fail the day. Days with nothing required are rest days and never break a streak. To pause a quest for a week, use the pause button next to it in the quest list.</p><p class="cmsg2" data-mmsg>'+esc(msg||"")+'</p></div>';
    function numIn(lbl,f,i,v,st,mn,mx){return '<label>'+lbl+'<input type="number" data-p="'+f+'" data-i="'+i+'" value="'+(v==null?"":v)+'" step="'+st+'" min="'+mn+'"'+(mx!=null?' max="'+mx+'"':'')+'></label>'}
    function txtIn(lbl,f,i,v,ph){return '<label>'+lbl+'<input data-p="'+f+'" data-i="'+i+'" value="'+esc(v||"")+'" placeholder="'+(ph||"")+'"></label>'}
    qDraft.forEach(function(q,i){
      var p=isPaused(q,T),par="";
      if(q.type==="todo")par='<label>Due (optional)<input type="date" data-p="due" data-i="'+i+'" value="'+esc(q.due||"")+'"></label>'+(q.doneOn?'<span class="pz ok">Done '+fmtD(q.doneOn)+'</span>':"");
      else if(q.type==="weekly")par=numIn("Times per week","min",i,q.min,1,1,7);
      else if(q.type==="time")par='<label>Goal type<select data-p="rollmode" data-i="'+i+'"><option value=""'+(q.roll?"":" selected")+'>Daily minimum</option><option value="roll"'+(q.roll?" selected":"")+'>Rolling weekly total</option></select></label>'+(q.roll?numIn("Weekly total (hours)","rollh",i,num(q.roll/60),"any",0.5):numIn("Min (minutes)","min",i,q.min,10,10,960))+numIn("Project total, hours (optional)","totalh",i,q.total?num(q.total/60):"","any",0);
      else if(q.type==="target")par=numIn("Goal","min",i,q.min,"any",0)+txtIn("Unit","ul",i,q.ul,"glasses")+numIn("Step","step",i,q.step||1,"any",0)+numIn("Project total (optional)","total",i,q.total||"","any",0);
      else if(q.type==="limit")par=numIn("Max","max",i,q.max,1,0,999)+'<label>Counts<select data-p="unit" data-i="'+i+'"><option value=""'+(q.unit==="min"?"":" selected")+'>number</option><option value="min"'+(q.unit==="min"?" selected":"")+'>minutes</option></select></label>'+(q.unit==="min"?"":txtIn("Unit","ul",i,q.ul,"cups"));
      else if(q.type==="wake")par='<label>From<input type="time" data-p="from" data-i="'+i+'" value="'+q.from+'"></label><label>To<input type="time" data-p="to" data-i="'+i+'" value="'+q.to+'"></label>';
      else if(q.type==="scale")par='<label>Out of<select data-p="scale" data-i="'+i+'"><option value="5"'+((q.scale||5)==5?" selected":"")+'>5</option><option value="10"'+(q.scale==10?" selected":"")+'>10</option></select></label>'+numIn("Pass at","min",i,q.min,1,1,q.scale||5);
      var days=q.days&&q.days.length?q.days:[0,1,2,3,4,5,6],dh='<div class="days" role="group" aria-label="Days">';[1,2,3,4,5,6,0].forEach(function(d){dh+='<button type="button" class="stone mini'+(days.indexOf(d)>=0?' on':'')+'" data-day="'+i+','+d+'" aria-pressed="'+(days.indexOf(d)>=0)+'">'+DN[d].slice(0,2)+'</button>'});dh+='</div>';
      if(q.completed)return;
      var sjs=subjList(),sl=qSubjs(q),sjo=sl.length?subjById(sl[0]):null,linkH='',topAll=[];sl.forEach(function(id){var s4=subjById(id);(s4.topics||[]).forEach(function(t){topAll.push({s:s4,t:t})})});
      if(q.type!=="todo"){linkH=(sjs.length?'<div class="sjfield"><span class="sjlab">Feeds subjects</span>'+subjChips('data-sjt="'+i+'" data-sj',sl)+'</div>':'')+'<div class="edrow">'+(topAll.length?'<label>Default topic<select data-p="topic" data-i="'+i+'"><option value="">Ask each time</option>'+topAll.map(function(o){return '<option value="'+o.t.id+'"'+(q.topic===o.t.id?" selected":"")+'>'+(sl.length>1?esc(o.s.name)+' \u203a ':'')+esc(o.t.name)+'</option>'}).join("")+'</select></label>':'')+
        (q.dl?'<p class="help">Completes when its deadline target is met or the deadline passes.</p>':'<label>Done when<select data-p="fin" data-i="'+i+'"><option value="">Ongoing (no finish line)</option>'+((q.type==="time"||q.type==="target")?'<option value="total"'+(q.fin&&q.fin.t==="total"?" selected":"")+'>Project total reached</option>':'')+(sjo?'<option value="subject"'+(q.fin&&q.fin.t==="subject"?" selected":"")+'>Subject reaches a level</option>':'')+(sjo&&q.topic?'<option value="topic"'+(q.fin&&q.fin.t==="topic"?" selected":"")+'>Topic reaches a level</option>':'')+'</select></label>'+(q.fin&&(q.fin.t==="subject"||q.fin.t==="topic")?'<label>Level<select data-p="finlvl" data-i="'+i+'">'+[2,3,4,5].map(function(v){return '<option value="'+v+'"'+((q.fin.lvl||4)===v?" selected":"")+'>'+LV[v]+'</option>'}).join("")+'</select></label>':'')+(q.fin&&q.fin.t==="total"&&!q.total?'<span class="pz">Set a project total above</span>':''))+'</div>'}
      if(q.type!=="todo"&&strictOn())linkH+='<div class="edrow"><label>Change rules<select data-p="lock" data-i="'+i+'">'+LOCKS.map(function(L){return '<option value="'+L[0]+'"'+(lockOf(q)===L[0]?" selected":"")+'>'+L[1]+'</option>'}).join("")+'</select></label><span class="pz">'+(LOCKS.filter(function(L){return L[0]===lockOf(q)})[0]||LOCKS[0])[2]+'</span></div>'+(q.pending?'<p class="help warnc">Scheduled: '+pendText(q.pending)+' on '+fmtD(q.pending.due)+'</p>':'');
      h+='<div class="mq'+(p?' paused':'')+(mqOpenId===q.id?' open':'')+'" data-idx="'+i+'" data-qid="'+q.id+'"><div class="edrow mqtop"><button type="button" class="dragh" data-drag="'+i+'" aria-label="Drag to reorder '+esc(q.label)+'" title="Drag to reorder (or use arrow keys)"><i></i></button><input data-p="label" data-i="'+i+'" value="'+esc(q.label)+'" aria-label="Quest name"><span class="ty">'+TN[q.type]+'</span><button type="button" class="stone mq-tog" data-tog="'+q.id+'" aria-label="Show settings for '+esc(q.label)+'" aria-expanded="'+(mqOpenId===q.id)+'"><i></i></button></div><span class="mqsum">'+esc(reqText(q))+(q.lock&&q.lock!=="flex"?' \u00b7 '+(q.lock==="fortnight"?"locked":"free"):'')+(q.pending?' \u00b7 '+pendText(q.pending).toLowerCase()+' scheduled':'')+'</span><div class="edrow">'+par+'<label class="grow">Note<input data-p="note" data-i="'+i+'" value="'+esc(q.note||"")+'"></label></div>'+linkH+'<div class="edrow">'+(q.type==="todo"?'<p class="help">A one-off task. It stays on your list until you mark it done, then disappears the next day. It never affects the streak.</p>':q.type==="weekly"?'<p class="help">Tap "Done today" on any day you do it. Weekly goals never fail a day or affect the streak; hitting the target earns bonus XP.</p>':dh+'<button type="button" class="stone mini'+(q.opt?' on':'')+'" data-opt="'+i+'" aria-pressed="'+!!q.opt+'">Optional</button>')+'</div><div class="edrow end">'+(p?'<span class="pz">Paused until '+fmtD(add(q.pausedUntil,-1))+'</span>':'')+'<button type="button" class="stone del" data-del="'+i+'">Delete</button></div></div>';
    });
    h+='<div class="mq add"><p class="help">To add a quest, close the editor and use + New quest.</p></div>';
    h+='<div class="edrow end"><button type="button" class="stone" data-mcancel>Cancel</button><button type="button" class="stone save" data-msave>Save quests</button></div>';
    qmgr.innerHTML=h;
    qmgr.querySelectorAll("[data-sj]").forEach(function(x){x.addEventListener("click",function(){var q=qDraft[+x.getAttribute("data-sjt")],id=x.getAttribute("data-sj"),L=qSubjs(q),k=L.indexOf(id);if(k>=0)L.splice(k,1);else L.push(id);setSubjs(q,L);if(q.topic&&!L.some(function(sid){var s5=subjById(sid);return s5&&(s5.topics||[]).some(function(t){return t.id===q.topic})}))delete q.topic;drawMgr()})});
    qmgr.querySelectorAll("[data-tog]").forEach(function(x){x.addEventListener("click",function(){var id=x.getAttribute("data-tog");mqOpenId=mqOpenId===id?null:id;drawMgr();var el=qmgr.querySelector('.mq[data-qid="'+id+'"]');if(el&&mqOpenId)el.scrollIntoView({block:"nearest"})})});
    qmgr.querySelectorAll("[data-p]").forEach(function(x){x.addEventListener(x.tagName==="SELECT"?"change":"input",function(){var q=qDraft[+x.getAttribute("data-i")],f=x.getAttribute("data-p"),v=x.value;
      if(f==="unit"){if(v)q.unit=v;else delete q.unit;drawMgr();return}
      if(f==="scale"){q.scale=+v;if(q.min>q.scale)q.min=q.scale;drawMgr();return}
      if(f==="lock"){q.lock=v;drawMgr();return}
      if(f==="subj"){if(v)q.subj=v;else{delete q.subj;delete q.topic;if(q.fin&&q.fin.t!=="total")delete q.fin}drawMgr();return}
      if(f==="topic"){if(v)q.topic=v;else{delete q.topic;if(q.fin&&q.fin.t==="topic")delete q.fin}drawMgr();return}
      if(f==="fin"){if(v)q.fin={t:v,lvl:(q.fin&&q.fin.lvl)||4};else delete q.fin;drawMgr();return}
      if(f==="finlvl"){if(q.fin)q.fin.lvl=+v;return}
      if(f==="rollmode"){if(v)q.roll=q.roll||Math.max(60,(q.min||30)*7);else delete q.roll;drawMgr();return}
      if(f==="rollh"){var rh=num(v);if(rh>0)q.roll=Math.round(rh*60);return}
      if(f==="total"||f==="totalh"){var tv=num(v);if(tv>0)q.total=f==="totalh"?Math.round(tv*60):tv;else delete q.total;return}
      if(f==="min"||f==="max"||f==="step"){v=(q.type==="target"||f==="step")?num(v):Math.max(0,Math.round(+v||0))}
      q[f]=v})});
    qmgr.querySelectorAll("[data-day]").forEach(function(x){x.addEventListener("click",function(){var a=x.getAttribute("data-day").split(","),q=qDraft[+a[0]],d=+a[1],ds=q.days&&q.days.length?q.days.slice():[0,1,2,3,4,5,6],ix=ds.indexOf(d);if(ix>=0)ds.splice(ix,1);else ds.push(d);if(ds.length===7)delete q.days;else q.days=ds;drawMgr()})});
    qmgr.querySelectorAll("[data-opt]").forEach(function(x){x.addEventListener("click",function(){var q=qDraft[+x.getAttribute("data-opt")];if(q.opt)delete q.opt;else q.opt=true;drawMgr()})});
    qmgr.querySelectorAll("[data-del]").forEach(function(x){var arm=null;x.addEventListener("click",function(){if(!arm){x.textContent="Confirm";arm=setTimeout(function(){arm=null;x.textContent="Delete"},4000);return}qDraft.splice(+x.getAttribute("data-del"),1);drawMgr()})});
    function nid(){return "q"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36)}
    qmgr.querySelectorAll("[data-mcancel]").forEach(function(x){x.addEventListener("click",function(){closeMgr();setSync("Quest changes discarded")})});
    var mtc=document.getElementById("mgrTdClr");if(mtc)mtc.addEventListener("click",function(){var T2=todayKey();qDraft=qDraft.filter(function(q){return !(q.type==="todo"&&q.doneOn&&q.doneOn<T2)});drawMgr("Finished to-dos removed (today\u2019s stay until tomorrow). Save to keep it.")});
    var ms=document.getElementById("mgrSort");if(ms)ms.addEventListener("click",function(){var O=["wake","time","target","weekly","check","todo","scale","limit"];qDraft.sort(function(a,b){return O.indexOf(a.type)-O.indexOf(b.type)});drawMgr("Sorted by type. Save to keep this order.")});
    qmgr.querySelectorAll("[data-drag]").forEach(function(hd){
      hd.addEventListener("keydown",function(ev){if(ev.key!=="ArrowUp"&&ev.key!=="ArrowDown")return;ev.preventDefault();var i=+hd.getAttribute("data-drag"),j=i+(ev.key==="ArrowUp"?-1:1);if(j<0||j>=qDraft.length)return;qDraft.splice(j,0,qDraft.splice(i,1)[0]);drawMgr();var n=qmgr.querySelector('[data-drag="'+j+'"]');if(n)n.focus()});
      hd.addEventListener("pointerdown",function(ev){
        if(ev.button!==undefined&&ev.button!==0)return;ev.preventDefault();var row=hd.closest(".mq"),moved=false;row.classList.add("dragging");
        function mv(e){var rows=[].slice.call(qmgr.querySelectorAll(".mq[data-idx]")),placed=false;
          if(e.clientY<60)window.scrollBy(0,-12);else if(e.clientY>window.innerHeight-60)window.scrollBy(0,12);
          for(var r=0;r<rows.length;r++){var el=rows[r];if(el===row)continue;var bb=el.getBoundingClientRect();if(e.clientY<bb.top+bb.height/2){if(el.previousElementSibling!==row){el.parentNode.insertBefore(row,el);moved=true}placed=true;break}}
          if(!placed){var last=rows.filter(function(x){return x!==row}).pop();if(last&&last.nextElementSibling!==row){last.parentNode.insertBefore(row,last.nextSibling);moved=true}}}
        function up(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",up);row.classList.remove("dragging");
          if(moved){var order=[].slice.call(qmgr.querySelectorAll(".mq[data-idx]")).map(function(x){return +x.getAttribute("data-idx")});qDraft=order.map(function(k){return qDraft[k]}).concat(qDraft.filter(function(_,k){return order.indexOf(k)<0}));drawMgr("Order changed. Save to keep it.")}}
        document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up);document.addEventListener("pointercancel",up);
      });
    });
    var mc=document.getElementById("mgrClear"),mca=null;if(mc)mc.addEventListener("click",function(){if(!mca){mc.textContent="Confirm clear";mca=setTimeout(function(){mca=null;mc.textContent="Clear all quests"},4000);return}clearTimeout(mca);qDraft=[];drawMgr("All quests removed. Save to confirm, or Cancel to keep them.")});
    qmgr.querySelectorAll("[data-msave]").forEach(function(x){x.addEventListener("click",saveMgr)});
  }
  function saveMgr(){var T=todayKey();var ovm=overDays(qDraft);if(ovm.length){drawMgr(ovm.map(function(o){return WDN[o.w]+": "+o.n}).join(", ")+" quests. That\u2019s over your daily limit of "+capOf()+". Untick some days, make one optional, or pause or complete one.");return}{
      var bad=qDraft.filter(function(q){return !(q.label||"").trim()||((q.type==="time"||q.type==="weekly")&&!(q.min>0))||(q.type==="target"&&!(q.min>0&&(+q.step||1)>0))||(q.type==="limit"&&!(q.max>=0))||(q.type==="scale"&&!(q.min>=1&&q.min<=(q.scale||5)))||(q.type==="wake"&&!(q.from&&q.to&&q.from<q.to))||(q.days&&!q.days.length)})[0];
      if(bad){drawMgr("Check "+(bad.label||"a quest")+": it needs a name and valid values.");return}
      qDraft.forEach(function(q){if(q.type==="weekly"||q.type==="todo"){delete q.days;delete q.opt}if(q.type==="todo"&&!q.due)delete q.due;q.label=q.label.trim();if(q.note!=null&&!String(q.note).trim())delete q.note});
      var c5=clone(cfg()),oldQ=clone(c5.quests),ids=easedIds(oldQ,qDraft,T),om={};oldQ.forEach(function(q){om[q.id]=q});
      var queued=[],flexIds=[];ids.forEach(function(id){var o=om[id],lk=o?lockOf(o):"flex";if(easeInfo().setup||lk==="free")return;if(lk==="fortnight")queued.push(id);else flexIds.push(id)});
      var g=guardEasing(c5,oldQ,flexIds);if(!g.ok){drawMgr(g.msg);return}
      var nm={};qDraft.forEach(function(q){nm[q.id]=q});var due0=null;
      var finalQ=qDraft.map(function(q){if(queued.indexOf(q.id)<0){if(q.lock==="fortnight"&&(!om[q.id]||lockOf(om[q.id])!=="fortnight"))q.lockFrom=T;return q}var o=clone(om[q.id]);o.pending={op:"replace",due:cycleDue(o,T),q:(function(){var x=clone(q);delete x.pending;return x})()};due0=o.pending.due;return o});
      queued.forEach(function(id){if(!nm[id]){var o=clone(om[id]);o.pending={op:"delete",due:cycleDue(o,T)};due0=o.pending.due;var idx=oldQ.findIndex(function(z){return z.id===id});finalQ.splice(Math.min(idx,finalQ.length),0,o)}});
      c5.quests=finalQ;saveCfg(c5);
      if(S.days[T]&&!S.days[T].ended){S.days[T]=Object.assign({},S.days[T],{q:activeDefs(T)});dirty[T]=true;cache();clearTimeout(timer);timer=setTimeout(flush,300)}
      qSig="";closeMgr();if(queued.length){setSync(queued.length+" locked quest change"+(queued.length===1?"":"s")+" scheduled for "+fmtD(due0)+".");return}setSync(g.eased?"Saved. "+g.eased+" easing change"+(g.eased===1?"":"s")+" take"+(g.eased===1?"s":"")+" effect tomorrow"+(g.left!=null?" ("+g.left+"/"+EASE_BUDGET+" left this week).":"."):"Quests saved");
    }
  }
  document.getElementById("qEditBtn").addEventListener("click",function(){mgrOpen?closeMgr():openMgr()});
  renderRules();applyTheme();renderSettings();

