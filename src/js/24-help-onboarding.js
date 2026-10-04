  /* ---- help + onboarding ---- */
  var HELPHTML='<div class="ed help-g">'+
    '<p class="sh2">Quests</p><p class="help">The things you want to do each day. Most are required; optional quests, weekly goals and to-dos never fail a day.</p>'+
    '<p class="sh2">Clearing a day</p><p class="help">A day is cleared when every required quest is done and no limit is broken. Each day locks at day end (midnight unless you change it in Settings).</p>'+
    '<p class="sh2">Streak</p><p class="help">Consecutive cleared days. Missing one day is a grace day and the streak survives. Missing two in a row resets it.</p>'+
    '<p class="sh2">Rebase</p><p class="help">After a reset, you note what broke the streak, then clear 3 days in a row with no grace day.</p>'+
    '<p class="sh2">Freezes</p><p class="help">Earned every 14 clean days (hold up to 3). A freeze saves the streak when you miss two days in a row.</p>'+
    '<p class="sh2">Gold day</p><p class="help">A cleared day where every time quest also reached its plan.</p>'+
    '<p class="sh2">XP and ranks</p><p class="help">Minutes and finished quests earn XP. Your level never goes down. Ranks follow your streak.</p>'+
    '<p class="sh2">Weekly totals and carried days</p><p class="help">Weekly-total quests are judged on your last 7 days, not on one day. Extra work builds a surplus. A day you log nothing can still keep your streak if the last 7 days still meet the weekly total; that\u2019s a carried day, and it spends some of the surplus. When the surplus runs out, an empty day counts as a miss. Carried days hold your streak but give no XP or grove growth. Logging anything, even 5 minutes, makes the day count normally.</p>'+
    '<p class="sh2">Rest and vacation</p><p class="help">Days with nothing required, or vacation days, never break a streak.</p>'+
    '<p class="sh2">Your data</p><p class="help">Everything stays on this device. Use Export backup in Settings to keep a copy.</p></div>';
  function openHelp(){openG("How it works",function(b){b.innerHTML=HELPHTML+'<div class="edrow end"><button type="button" class="stone" id="hlpClose">Got it</button></div>';b.querySelector("#hlpClose").addEventListener("click",closeG)})}
  document.getElementById("helpBtn").addEventListener("click",openHelp);
  function openWelcome(){
    var pick=null,style=null;
    function steps(){return[
      {t:"How do you work?",h:'<p class="mhead">Pick the style that sounds most like you.</p><p class="help">It sets sensible defaults. You can change it any time in Settings.</p>'+styleCards(style,"data-ws")},
      {t:"Welcome",h:'<p class="mhead">Build habits like a game.</p><p class="help">Pick a starter pack to begin, or start empty and add your own quests.</p><div class="packs wel" role="radiogroup" aria-label="Starter pack">'+["Student","Fitness","Creative","Wellness","Deep Work",""].map(function(p){var on=pick===p;return '<button type="button" class="stone'+(on?' on':'')+'" role="radio" aria-checked="'+on+'" data-wp="'+p+'">'+(p||"Start empty")+'</button>'}).join("")+'</div>'},
      {t:"How a day works",h:'<p class="mhead">Do your quests, clear the day.</p><p class="help">Each quest shows what counts as done. When every required quest is done (and no limit is broken), the day is cleared.</p><p class="help">Use <b>+ New quest</b> to add more, and <b>End day</b> before bed to lock it in and get your wrap-up.</p>'},
      {t:"Streaks and rewards",h:'<p class="mhead">Keep the streak alive.</p><p class="help">Cleared days in a row build your streak, rank, badges and your grove. One missed day is forgiven; two in a row resets the streak.</p><p class="help">Tap <b>?</b> any time for the full guide.</p>'}
    ]}
    openG("",function(b){
      function draw(step){
        var s=steps()[step],last=step===3,need=(step===0&&style===null)||(step===1&&pick===null);gTitle.textContent=s.t+" ("+(step+1)+"/4)";
        b.innerHTML=s.h+'<div class="edrow end">'+(step>0?'<button type="button" class="stone" id="wBack">Back</button>':'<button type="button" class="stone" id="wSkip">Skip</button>')+(last?'<button type="button" class="stone save" id="wDone">Let\u2019s go</button>':'<button type="button" class="stone save" id="wNext"'+(need?' disabled':'')+'>Next</button>')+'</div>';
        b.querySelectorAll("[data-ws]").forEach(function(x){x.addEventListener("click",function(){style=x.getAttribute("data-ws");draw(0)})});
        b.querySelectorAll("[data-wp]").forEach(function(x){x.addEventListener("click",function(){pick=x.getAttribute("data-wp");draw(1)})});
        var n=b.querySelector("#wNext");if(n)n.addEventListener("click",function(){draw(step+1)});
        var bk=b.querySelector("#wBack");if(bk)bk.addEventListener("click",function(){draw(step-1)});
        var sk=b.querySelector("#wSkip");if(sk)sk.addEventListener("click",function(){pick=null;style=null;closeG()});
        var d=b.querySelector("#wDone");if(d)d.addEventListener("click",closeG);
      }
      draw(0);
    },function(){try{localStorage.setItem("pc-welcomed","1")}catch(x){}if(style)applyStyle(style,true);if(pick&&!(cfg().quests||[]).length)applyPack(pick)});
  }



