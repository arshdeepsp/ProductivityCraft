  /* ---- achievements ---- */
  var grid=document.getElementById("achGrid"),toast=document.getElementById("toast"),cards={};
  D.ach.forEach(function(a){
    var el=document.createElement("div");el.className="ach px";
    el.innerHTML='<div class="slot">'+svg(a.icon)+'</div><div><div class="t1"></div><div class="t2"></div><div class="t3"></div><div class="st"></div><button type="button" hidden>Download PDF</button></div>';
    el.querySelector(".t2").textContent=a.title;el.querySelector(".t3").textContent=a.desc;
    var b=el.querySelector("button");b.addEventListener("click",function(){save(a,b)});
    grid.appendChild(el);cards[a.id]=el;
  });
  function save(a,b){
    var bin=atob(a.pdf),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    if(!dl){try{var url=URL.createObjectURL(new Blob([u],{type:"application/pdf"})),x=document.createElement("a");x.href=url;x.download=a.file;document.body.appendChild(x);x.click();x.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000);b.textContent="Saved"}catch(e){b.textContent="Unavailable"}return}
    b.disabled=true;dl.save({filename:a.file,data:new Blob([u])}).then(function(){b.textContent="Saved"},function(e){b.textContent=(e&&e.code==="declined")?"Download PDF":"Unavailable"}).finally(function(){b.disabled=false});
  }
  function showToast(a){
    toast.innerHTML='<div class="ach px"><div class="slot">'+svg(a.icon)+'</div><div><div class="t1">Achievement unlocked!</div><div class="t2"></div><div class="t3"></div></div></div>';
    toast.querySelector(".t2").textContent=a.title;toast.querySelector(".t3").textContent=a.desc;
    requestAnimationFrame(function(){toast.classList.add("show")});setTimeout(function(){toast.classList.remove("show")},5000);
  }

