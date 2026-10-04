  /* ---- custom achievements ---- */
  var caEl=document.getElementById("achCustom"),caSig="",caCards={};
  function caProg(a,st,lv){return a.kind==="total"?st.total:a.kind==="level"?lv:st.streak}
  function caLabel(a){return a.kind==="total"?a.n+" cleared days":a.kind==="level"?"Level "+a.n:a.n+"-day streak"}
  function certPDF(a,btn){
    btn.disabled=true;setSync("Building certificate\u2026");
    Promise.all([loadPDF(),document.fonts&&document.fonts.load?Promise.all([document.fonts.load('20px "Press Start 2P"')]).catch(function(){}):null]).then(function(r){
      var J=r[0],W=1650,H=1275,c=document.createElement("canvas");c.width=W;c.height=H;var g=c.getContext("2d"),PX='"Press Start 2P", monospace';
      g.fillStyle="#18202E";g.fillRect(0,0,W,H);for(var y=0;y<H;y+=50)for(var x=0;x<W;x+=50)if(((x+y)/50)%2===0){g.fillStyle="#1C2536";g.fillRect(x,y,50,50)}
      var tw=1170,th=355,tx=(W-tw)/2,ty=H/2-360,gg=12;
      function pr(x,y,w,h,col){g.fillStyle=col;g.fillRect(x+gg,y,w-2*gg,h);g.fillRect(x,y+gg,w,h-2*gg)}
      pr(tx-gg,ty-gg,tw+2*gg,th+2*gg,"#000");pr(tx,ty,tw,th,"#555");pr(tx+gg,ty+gg,tw-2*gg,th-2*gg,"#212121");
      var s=230,sx=tx+62,sy=ty+(th-s)/2;g.fillStyle="#8B8B8B";g.fillRect(sx-16,sy-16,s+32,s+32);g.fillStyle="#C6C6C6";g.fillRect(sx-8,sy-8,s+16,s+16);
      var ic=D.icons[a.icon]||D.icons.star,p=s/16;ic.rows.forEach(function(row,ry){for(var rx=0;rx<16;rx++){var ch=row[rx];if(ch!=="."){g.fillStyle=ic.pal[ch];g.fillRect(Math.round(sx+rx*p),Math.round(sy+ry*p),Math.ceil(p),Math.ceil(p))}}});
      var X=sx+s+70;g.textAlign="left";g.font="31px "+PX;g.fillStyle="#FFFF55";g.fillText("Achievement unlocked!",X,ty+120);
      var fs=42,t=a.title,avail=tw-(X-tx)-40;g.fillStyle="#fff";g.font=fs+"px "+PX;while(g.measureText(t).width>avail&&fs>22){fs-=2;g.font=fs+"px "+PX}while(g.measureText(t).width>avail&&t.length>4)t=t.slice(0,-2)+"\u2026";g.fillText(t,X,ty+205);
      g.font="20px "+PX;g.fillStyle="#BDBDBD";g.fillText(a.desc||"",X,ty+270);
      g.textAlign="center";g.font="24px "+PX;g.fillStyle="#E6E6E6";g.fillText(caLabel(a),W/2,ty+th+150);
      g.font="19px "+PX;g.fillStyle="#9AA2B1";g.fillText("Custom achievement \u00b7 "+new Date().toLocaleDateString("en-CA",{month:"long",day:"numeric",year:"numeric"}),W/2,ty+th+205);g.fillText("ProductivityCraft",W/2,H-100);
      var pdf=new J({orientation:"landscape",unit:"pt",format:"letter"});pdf.setProperties({title:"Achievement unlocked: "+a.title});pdf.addImage(c.toDataURL("image/png"),"PNG",0,0,792,612,undefined,"FAST");
      var blob=pdf.output("blob"),name="achievement-"+a.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+".pdf";
      if(dl)return dl.save({filename:name,data:blob}).then(function(){setSync("Certificate saved")},function(){setSync("Certificate couldn't be saved here")});
      var u=URL.createObjectURL(blob),an=document.createElement("a");an.href=u;an.download=name;document.body.appendChild(an);an.click();an.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000);setSync("Certificate saved");
    }).catch(function(){setSync("PDF engine didn't load. Check your connection.")}).finally(function(){btn.disabled=false});
  }
  function renderCustomAch(st){
    var L=cfg().customAch||[],sig=JSON.stringify(L);
    if(sig!==caSig){caSig=sig;caEl.innerHTML="";caCards={};L.forEach(function(a){
      var el=document.createElement("div");el.className="ach px";
      el.innerHTML='<div class="slot">'+svg(D.icons[a.icon]?a.icon:"star")+'</div><div><div class="t1"></div><div class="t2"></div><div class="t3"></div><div class="st"></div><button type="button" hidden>Download PDF</button></div>';
      el.querySelector(".t2").textContent=a.title;el.querySelector(".t3").textContent=a.desc||"";
      var b=el.querySelector("button");b.addEventListener("click",function(){certPDF(a,b)});caEl.appendChild(el);caCards[a.id]=el})}
    var lv=level(totalXP()).l,seen=[];try{seen=JSON.parse(localStorage.getItem("ca-seen")||"[]")}catch(x){}
    L.forEach(function(a){var el=caCards[a.id];if(!el)return;var p=caProg(a,st,lv),u=p>=a.n;el.classList.toggle("locked",!u);
      el.querySelector(".t1").textContent=u?"Achievement unlocked!":"Locked \u00b7 "+caLabel(a);
      el.querySelector(".st").textContent=u?"Custom goal reached":(a.n-p)+" to go";el.querySelector("button").hidden=!u;
      var tok=a.id+"|"+a.n+"|"+(a.kind==="streak"?(st.start||""):"");if(u&&seen.indexOf(tok)<0){seen.push(tok);showToast(a);try{localStorage.setItem("ca-seen",JSON.stringify(seen))}catch(x){}}});
    document.getElementById("achCustomWrap").hidden=!L.length;var cab=document.getElementById("caNewBtn");cab.hidden=L.length>=4;
  }
