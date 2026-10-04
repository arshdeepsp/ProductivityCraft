  /* ---- generic modal ---- */
  var gEl=document.getElementById("gModal"),gBody=document.getElementById("gBody"),gTitle=document.getElementById("gTitle"),gScrim=document.getElementById("modalScrim"),gLast=null,gOnClose=null;
  function openG(title,build,onClose){gLast=document.activeElement;gTitle.textContent=title;gBody.innerHTML="";gOnClose=onClose||null;gEl.hidden=false;gScrim.hidden=false;build(gBody);var f=gBody.querySelector("input,textarea,select,button");if(f)f.focus()}
  function closeG(){if(gEl.hidden)return;gEl.hidden=true;if(document.getElementById("nqModal").hidden)gScrim.hidden=true;var cb=gOnClose;gOnClose=null;if(cb)cb();if(gLast&&gLast.focus&&document.contains(gLast))gLast.focus()}
  document.getElementById("gClose").addEventListener("click",closeG);
  gScrim.addEventListener("click",function(){if(!gEl.hidden)closeG()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!gEl.hidden)closeG()});
  function fmtVal(q,e){var v=e[q.id];
    if(q.type==="wake")return v||"\u2014";if(q.type==="time")return hm(v)+" of "+hmL(q.min);if(q.type==="target")return num(v)+" / "+num(q.min)+(q.ul?" "+q.ul:"");
    if(q.type==="limit")return (q.unit==="min"?hm(v):(v|0))+" (max "+(q.unit==="min"?hmL(q.max):q.max)+")";if(q.type==="scale")return v?v+"/"+(q.scale||5):"\u2014";return v?"Done":"Not done"}
  function qList(e,defs){return '<div class="mlist">'+defs.map(function(q){var ok_=metQ(q,e),opt=q.opt||q.type==="weekly"||q.type==="todo";return '<div class="mrow'+(ok_?" ok":opt?" opt":" no")+'"><i class="mk"></i><span class="ml">'+esc(q.label)+(opt?' <em>optional</em>':'')+'</span><span class="mv">'+esc(fmtVal(q,e))+'</span></div>'}).join("")+'</div>'}
