  /* ---- top 3 today ---- */
  var t3El=document.getElementById("top3"),t3Built=false,top3Open=true;try{top3Open=localStorage.getItem("pc-top3")!=="0"}catch(x){}
  t3El.addEventListener("click",function(ev){if(ev.target&&ev.target.id==="t3h"){top3Open=!top3Open;try{localStorage.setItem("pc-top3",top3Open?"1":"0")}catch(x){}render()}});
  function renderTop3(e,past){
    if(!t3Built){t3Built=true;var h='<button type="button" class="t3h" id="t3h" aria-expanded="true">Top 3 today</button>';for(var i=0;i<3;i++)h+='<div class="t3r"><button type="button" class="t3c" data-i="'+i+'" aria-pressed="false" aria-label="Mark priority '+(i+1)+' done"></button><input class="t3i" data-i="'+i+'" maxlength="80" placeholder="Priority '+(i+1)+'"></div>';t3El.innerHTML=h;
      t3El.querySelectorAll(".t3i").forEach(function(x){x.addEventListener("change",function(){if(locked())return;var en=entry(),tp=(en.top||[{},{},{}]).map(function(z){return Object.assign({},z)});while(tp.length<3)tp.push({});tp[+x.getAttribute("data-i")].t=x.value.trim();en.top=tp;commit()})});
      t3El.querySelectorAll(".t3c").forEach(function(x){x.addEventListener("click",function(){if(locked())return;var en=entry(),tp=(en.top||[{},{},{}]).map(function(z){return Object.assign({},z)});while(tp.length<3)tp.push({});var i=+x.getAttribute("data-i");if(!tp[i].t)return;tp[i].d=!tp[i].d;en.top=tp;commit()})});}
    var tp=(e&&e.top)||[],t3n=tp.filter(function(x){return x&&x.t}),t3d=t3n.filter(function(x){return x.d}).length,th=document.getElementById("t3h");th.textContent="Top 3 today"+(t3n.length?" \u00b7 "+t3d+"/"+t3n.length+" done":"");t3El.classList.toggle("t3c-closed",!top3Open);th.setAttribute("aria-expanded",top3Open);
    t3El.querySelectorAll(".t3r").forEach(function(r,i){var it=tp[i]||{},inp=r.querySelector("input"),c=r.querySelector("button");if(document.activeElement!==inp)inp.value=it.t||"";inp.disabled=past;c.disabled=past||!it.t;c.setAttribute("aria-pressed",!!it.d);r.classList.toggle("done",!!it.d)});
    t3El.hidden=past&&!tp.some(function(x){return x&&x.t});
  }
