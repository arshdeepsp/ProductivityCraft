  /* ---- keep the field being typed just above the on-screen keyboard (phones) ---- */
  (function(){
    function isField(el){return el&&(el.tagName==="TEXTAREA"||(el.tagName==="INPUT"&&!/^(checkbox|radio|button|submit|range|color|file)$/.test(el.type))||el.isContentEditable)}
    function phone(){return window.innerWidth<=720}
    var active=null,vv=window.visualViewport;
    function settle(){if(!active||!phone())return;try{active.scrollIntoView({block:"end",inline:"nearest",behavior:"smooth"})}catch(x){active.scrollIntoView(false)}
      if(vv){var r=active.getBoundingClientRect(),bottom=vv.offsetTop+vv.height;if(r.bottom>bottom-12)window.scrollBy(0,r.bottom-bottom+24)}}
    document.addEventListener("focusin",function(e){if(!isField(e.target)||!phone())return;active=e.target;document.body.classList.add("typing");setTimeout(settle,120);setTimeout(settle,400)});
    document.addEventListener("focusout",function(e){if(e.target!==active)return;active=null;setTimeout(function(){if(!isField(document.activeElement))document.body.classList.remove("typing")},80)});
    if(vv)vv.addEventListener("resize",function(){if(active)settle()});
  })();
