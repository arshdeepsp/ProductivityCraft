  /* 5b. new custom achievement */
  function openCAModal(){
    if((cfg().customAch||[]).length>=4){setSync("You already have 4 custom achievements.");return}
    var A={title:"",desc:"",icon:"star",kind:"streak",n:30};
    openG("New custom achievement",function(b){
      function draw(msg){
        b.innerHTML='<div class="ed"><div class="capv"><div class="slot">'+svg(A.icon)+'</div><div class="iconpick">'+Object.keys(D.icons).map(function(k){return '<button type="button" class="stone mini'+(A.icon===k?' on':'')+'" data-ic="'+k+'" aria-label="'+k+'">'+svg(k)+'</button>'}).join("")+'</div></div><label>Title<input id="caT" maxlength="24" value="'+esc(A.title)+'" placeholder="First thesis chapter"></label><label>Description<input id="caD" maxlength="40" value="'+esc(A.desc)+'" placeholder="A goal of my own"></label><div class="edrow"><label>Unlocks at<select id="caK"><option value="streak"'+(A.kind==="streak"?" selected":"")+'>Streak (days)</option><option value="total"'+(A.kind==="total"?" selected":"")+'>Total cleared days</option><option value="level"'+(A.kind==="level"?" selected":"")+'>Level</option></select></label><label>Number<input type="number" id="caN" min="1" max="3650" value="'+A.n+'"></label></div><p class="cmsg2">'+esc(msg||"")+'</p><div class="edrow end"><button type="button" class="stone" id="caNo">Cancel</button><button type="button" class="stone save" id="caGo">Add achievement</button></div></div>';
        b.querySelectorAll("[data-ic]").forEach(function(x){x.addEventListener("click",function(){A.icon=x.getAttribute("data-ic");sync_();draw()})});
        function sync_(){A.title=b.querySelector("#caT").value;A.desc=b.querySelector("#caD").value;A.kind=b.querySelector("#caK").value;A.n=Math.max(1,Math.min(3650,Math.round(+b.querySelector("#caN").value||1)))}
        b.querySelector("#caNo").addEventListener("click",closeG);
        b.querySelector("#caGo").addEventListener("click",function(){sync_();if(!A.title.trim()){draw("Give it a title.");return}var c=clone(cfg());c.customAch=(c.customAch||[]).concat([{id:"ca"+Date.now().toString(36),title:A.title.trim(),desc:A.desc.trim(),icon:A.icon,kind:A.kind,n:A.n}]);saveCfg(c);closeG();render();setSync("Custom achievement added")});
      }
      draw();
    });
  }
  document.getElementById("caNewBtn").addEventListener("click",openCAModal);
  document.getElementById("sp5Btn").addEventListener("click",function(){start5()});
  document.getElementById("trendsBtn").addEventListener("click",function(){go("trends")});
  document.getElementById("pickBtn").addEventListener("click",openPick);
  document.getElementById("batchBtn").addEventListener("click",openBatch);
  document.getElementById("shareBtn").addEventListener("click",function(){shareWeek(this)});
