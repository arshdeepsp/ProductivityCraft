  /* ---- after a streak reset: a card, not a gate ---- The day the streak reset (st.resets' last entry, within the last
     RESET_CARD_DAYS) gets a dismissible card under the HUD: "Streak reset on Tue — what broke it?" with a note that is
     saved to S.refl[day] (visible on that day's past-day modal), or Skip (S.refl[day] = {skip:true}). Challenge only. */
  var RESET_CARD_DAYS=3;
  function resetCardDay(st){var last=st.resets&&st.resets[st.resets.length-1];if(!last||rewardsOff()||S.refl[last])return null;return daysBetween(last,todayKey())<=RESET_CARD_DAYS?last:null}
  function renderResetCard(st){var el=document.getElementById("resetCard");if(!el){el=document.createElement("div");el.id="resetCard";el.className="resetcard";el.hidden=true;var qw=document.getElementById("questsWrap");qw.parentNode.insertBefore(el,qw)}
    var k=resetCardDay(st);if(!k||ro()){el.hidden=true;return}if(el.dataset.k===k){el.hidden=false;return}el.dataset.k=k;el.hidden=false;
    el.innerHTML='<b>Streak reset on '+esc(fmtD(k))+'.</b><span>What got in the way? A line now makes the next one easier to spot.</span><textarea id="rcText" rows="2" maxlength="200" placeholder="e.g. late night, no plan for the morning"></textarea><div class="edrow end"><button type="button" class="stone" id="rcSkip">Skip</button><button type="button" class="stone save" id="rcSave">Save</button></div>';
    function done(v){S.refl=Object.assign({},S.refl);S.refl[k]=v;cache();el.hidden=true;delete el.dataset.k;setSync(v.skip?"Fresh start. The streak counts from your next cleared day.":"Noted. The streak counts from your next cleared day.")}
    el.querySelector("#rcSkip").addEventListener("click",function(){done({skip:true,at:new Date().toISOString()})});
    el.querySelector("#rcSave").addEventListener("click",function(){var t=el.querySelector("#rcText").value.trim();if(!t){el.querySelector("#rcText").focus();return}done({text:t,at:new Date().toISOString()})})}
