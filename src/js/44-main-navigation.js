  /* ---- main navigation ---- */
  var VIEWS=["today","subjects","rules","achievements","trends","settings"],curView="today";
  (function(){var sb=document.getElementById("settingsBody"),sp=document.getElementById("setPage");if(sb&&sp)sp.appendChild(sb)})();
  function go(v,noHash){
    if(v==="grove"){openGrove(false);return}
    if(VIEWS.indexOf(v)<0)v="today";curView=v;
    document.querySelectorAll("[data-view]").forEach(function(el){el.hidden=el.getAttribute("data-view")!==v});
    document.querySelectorAll("#mainnav [data-go]").forEach(function(b){var on=b.getAttribute("data-go")===v;b.classList.toggle("on",on);if(on)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
    document.body.setAttribute("data-cur",v);var vt=document.getElementById("viewTitle");if(vt)vt.textContent={today:"Today",subjects:"Subjects",rules:"Rules",achievements:"Badges",trends:"Trends",settings:"Settings"}[v]||"";var sb=document.getElementById("setBtn");if(sb)sb.classList.toggle("on",v==="settings");var tb=document.getElementById("trendsBtn");if(tb)tb.classList.toggle("on",v==="trends");
    if(v==="settings")renderSettings();if(v==="subjects")renderSubjects();if(v==="today"||v==="achievements")render();if(v==="trends")renderTrends();
    if(v==="achievements"&&!achOpen){achOpen=true;render()}
    if(!noHash&&location.hash!=="#"+v){try{history.pushState(null,"","#"+v)}catch(x){location.hash=v}}
    window.scrollTo(0,0);
  }
  document.querySelectorAll("#mainnav [data-go]").forEach(function(b){b.addEventListener("click",function(){go(b.getAttribute("data-go"))})});
  window.addEventListener("popstate",function(){go((location.hash||"#today").slice(1),true)});
  window.addEventListener("hashchange",function(){go((location.hash||"#today").slice(1),true)});
  /* ---- native app glue: files, back button, keep awake, ongoing focus notice ---- */
  function capPlugin(n){try{if(!nativeApp())return null;var C=window.Capacitor;return (C.Plugins&&C.Plugins[n])||(C.registerPlugin?C.registerPlugin(n):null)}catch(x){return null}}
  function toB64(data){return new Promise(function(res,rej){if(typeof data==="string"){try{res(btoa(unescape(encodeURIComponent(data))))}catch(e){rej(e)}return}var fr=new FileReader();fr.onload=function(){res(String(fr.result).split(",")[1]||"")};fr.onerror=rej;fr.readAsDataURL(data instanceof Blob?data:new Blob([data]))})}
  if(nativeApp()){var FS=capPlugin("Filesystem"),SH=capPlugin("Share");if(FS&&SH)dl={save:function(o){return toB64(o.data).then(function(b64){return FS.writeFile({path:o.filename,data:b64,directory:"CACHE"})}).then(function(r){return SH.share({title:o.filename,files:[r.uri]})}).catch(function(e){var m=String(e&&e.message||e||"");if(/cancel/i.test(m))throw{code:"declined"};throw e})}}}
  (function(){var AP=capPlugin("App");if(!AP||!AP.addListener)return;AP.addListener("backButton",function(){
    var qm=document.querySelector(".qmenu");if(qm){closeQMenu();return}
    if(!document.getElementById("gModal").hidden){closeG();return}
    if(!document.getElementById("nqModal").hidden){var nb=document.querySelector("#nqModal .drawer-h .stone");if(nb)nb.click();return}
    if(groveOpen){closeGrove();return}
    if(S.sprint&&!spEl.hidden){spHide();return}
    if(!document.getElementById("mgrSheet").hidden){closeMgr();return}
    if(curView!=="today"){go("today");return}
    if(AP.minimizeApp)AP.minimizeApp();else if(AP.exitApp)AP.exitApp()})})();
  var wakeOn=false,wakeLockObj=null,ongoingSig="";
  function focusActive(){return !!(S.timer||(S.sprint&&S.sprint.phase!=="done"))}
  function focusSync(){
    var want=focusActive()&&cfg().keepAwake!==false&&document.visibilityState==="visible";
    if(want!==wakeOn){wakeOn=want;var KA=capPlugin("KeepAwake");
      if(KA){(want?KA.keepAwake():KA.allowSleep()).catch(function(){})}
      else if(navigator.wakeLock){if(want)navigator.wakeLock.request("screen").then(function(l){wakeLockObj=l}).catch(function(){wakeOn=false});else if(wakeLockObj){wakeLockObj.release().catch(function(){});wakeLockObj=null}}}
    var n=nf(),t=null,b=null,when=null,down=false,chrono=false,next=null;
    if(n.on&&n.timer){
      if(S.timer){var c5=S.timer.commit&&!S.timer.c5;t=(c5?"Just 5 minutes: ":"Focusing: ")+S.timer.label;b=S.timer.first?"First: "+S.timer.first:"Tap to return";chrono=true;down=!!c5;when=c5?S.timer.start+S.timer.commit*60000:S.timer.start;
        if(c5)next={title:"Focusing: "+S.timer.label,body:"5 minutes done. Keep going or stop to log it.",when:Math.round(S.timer.start),countdown:false,chrono:true}}
      else if(S.sprint&&S.sprint.phase==="focus"){var sp=S.sprint;t="Sprint: "+spLabel(sp.cur);if(sp.paused)b="Paused";else{b="Block "+sp.block+(sp.rounds?" of "+sp.rounds:"");chrono=true;down=true;when=sp.end;
          var last=sp.rounds&&sp.block>=sp.rounds,lb=sp.longEvery&&sp.block%sp.longEvery===0,bend=sp.end+(lb?30:15)*60000;
          next=last?{title:"Sprint complete",body:"Open the app to see your summary.",chrono:false}:{title:lb?"Long break":"Decision break",body:"Next block when this reaches zero",when:Math.round(bend),countdown:true,chrono:true,next:{title:"Break over",body:"Start your next block",chrono:false}}}}
      else if(S.sprint&&S.sprint.phase==="break"){t=S.sprint.long?"Long break":"Decision break";if(S.sprint.breakDone)b="Break over \u2014 start your next block";else{b="Next block when this reaches zero";chrono=true;down=true;when=S.sprint.bend;next={title:"Break over",body:"Start your next block",chrono:false}}}}
    var sig=t?[t,b,when,down].join("|"):"";if(sig===ongoingSig)return;ongoingSig=sig;
    function legacy(){var ln=LN();if(!ln)return;ln.cancel({notifications:[{id:900}]}).catch(function(){}).then(function(){if(!t)return;return ensureChannels().then(function(){return ln.schedule({notifications:[{id:900,title:t,body:b,ongoing:true,autoCancel:false,channelId:"pc_focus",schedule:{at:new Date(Date.now()+400)}}]})})}).catch(function(){})}
    var FN=capPlugin("FocusNotify");
    if(FN&&FN.show){(t?FN.show({title:t,body:b,when:when==null?null:Math.round(when),countdown:down,chrono:chrono,next:next}):FN.hide()).catch(legacy);return}
    legacy()}
  setInterval(focusSync,3000);document.addEventListener("visibilitychange",function(){wakeOn=!wakeOn&&false;focusSync()});
