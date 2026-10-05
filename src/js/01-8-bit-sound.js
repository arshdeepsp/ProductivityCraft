  /* ---- 8-bit sound ---- */
  var AC=null,sfxOn=true;try{sfxOn=localStorage.getItem("pc-sfx")!=="off"}catch(e){}
  function tone(f,t0,dur,type,vol){var o=AC.createOscillator(),g=AC.createGain();o.type=type||"square";o.frequency.setValueAtTime(f,AC.currentTime+t0);g.gain.setValueAtTime(vol||.06,AC.currentTime+t0);g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+t0+dur);o.connect(g);g.connect(AC.destination);o.start(AC.currentTime+t0);o.stop(AC.currentTime+t0+dur+.02)}
  function sfx(kind){try{if(kind==="base")haptic("medium",true);else if(kind==="clear"||kind==="level"||kind==="chime")haptic("success",true);else if(kind==="fail")haptic("error",true)}catch(x){}
    if(!sfxOn)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume()}catch(e){return}
    if(kind==="base"){tone(988,0,.07);tone(1319,.07,.12)}
    else if(kind==="clear"){[523,659,784,1047].forEach(function(f,i){tone(f,i*.09,.14)})}
    else if(kind==="gold"){[784,988,1175,1568,2093].forEach(function(f,i){tone(f,i*.08,.16,"triangle",.08)})}
    else if(kind==="fail"){tone(110,0,.35,"sawtooth",.07);tone(82,.18,.35,"sawtooth",.07)}
    else if(kind==="chime"){[1047,1319,1568,2093].forEach(function(f,i){tone(f,i*.11,.22,"triangle",.09)})}
    else if(kind==="level"){[392,523,659,784,659,1047].forEach(function(f,i){tone(f,i*.1,.18,"triangle",.09)})}
  }
  /* Tap sounds: a short 8-bit click that goes with every haptic tap. Off with Settings › Tap sounds, or with Sound off. */
  var TAPS={light:[1568,.03,.025],medium:[1175,.05,.035],heavy:[784,.07,.045]};
  function tapSound(k){var t=TAPS[k];if(!t||!sfxOn||(S.cfg&&S.cfg.tapSound===false))return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume();tone(t[0],0,t[1],"square",t[2])}catch(x){}}
  function bases(e){e=e||{};return reqOf(defsOf(e)).filter(function(q){return metQ(q,e)}).length}
  function svg(name){var ic=D.icons[name],r="";ic.rows.forEach(function(row,y){for(var x=0;x<16;x++){var ch=row[x];if(ch!==".")r+='<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+ic.pal[ch]+'"/>'}});return '<svg viewBox="0 0 16 16" aria-hidden="true">'+r+'</svg>'}
  function hm(m){m=m|0;var h=Math.floor(m/60),r=m%60;return h?h+"h"+(r?" "+r+"m":""):r+"m"}

  function compute(asOf){
    buildBank();
        var T=asOf?add(asOf,1):todayKey(),Y=add(T,-1),st={fz:0,streak:0,best:0,total:0,miss:0,rebase:false,rc:0,resets:[],start:null,marks:{}};
    function success(k){st.streak++;st.total++;st.miss=0;if(st.streak%14===0)st.fz=Math.min(fzCap(),st.fz+1);if(st.streak===1)st.start=k;if(st.rebase){st.rc++;if(st.rc>=3){st.rebase=false;st.rc=0}}st.best=Math.max(st.best,st.streak);st.marks[k]="ok"}
    function reset(k){st.resets.push(k);st.streak=0;st.start=null;st.rebase=true;st.rc=0;st.miss=0}
    st.carry=0;
    if(T<START_KEY)return st;
    for(var k=START_KEY;k<T;k=add(k,1)){
      if(!reqDefsFor(k).length){st.marks[k]="rest";continue}
      if(!hasEntry(S.days[k])&&carriedOK(k)){st.carry++;st.marks[k]="carried";continue}
      st.carry=0;
      if(ok(S.days[k])){success(k);continue}
      st.miss++;
      if(st.rebase){if(st.streak>0||st.rc>0){st.marks[k]="miss";reset(k)}else st.marks[k]="miss";st.rc=0}
      else if(st.miss>=2&&st.fz>0&&st.streak>0){st.fz--;st.miss=1;st.marks[k]="frozen"}
      else if(st.miss>=2){st.marks[k]="miss";st.marks[add(k,-1)]="miss";if(st.streak>0)reset(k)}
      else st.marks[k]=st.streak>0?"grace":"miss";
    }
    if(!asOf&&T>=START_KEY){if(!reqDefsFor(T).length)st.marks[T]="rest";else if(ok(S.days[T]))success(T);else st.marks[T]="pend"}
    var last=st.resets[st.resets.length-1];st.gate=last&&!S.refl[last]?last:null;
    return st;
  }

