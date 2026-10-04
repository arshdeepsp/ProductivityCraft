  /* 3. streak lost reflection */
  var gateShown={};
  function maybeGateModal(st){
    if(!st.gate||gateShown[st.gate]||!gEl.hidden)return;gateShown[st.gate]=true;
    openG("Streak lost",function(b){
      b.innerHTML='<p class="mhead bad">Two missed days in a row reset your streak.</p><p class="help">Before the quests unlock, write down what broke it and what changes tomorrow. Then clear 3 days in a row with no grace day to finish rebasing.</p><textarea id="gmText" maxlength="500" rows="5" placeholder="What broke it, and what changes tomorrow?"></textarea><div class="edrow end"><button type="button" class="stone" id="gmLater">Later</button><button type="button" class="stone save" id="gmGo" disabled>Start rebase</button></div>';
      var t=b.querySelector("#gmText"),g=b.querySelector("#gmGo");t.addEventListener("input",function(){g.disabled=t.value.trim().length<10});
      b.querySelector("#gmLater").addEventListener("click",closeG);
      g.addEventListener("click",function(){var s2=compute();if(!s2.gate)return closeG();S.refl=Object.assign({},S.refl);S.refl[s2.gate]={text:t.value.trim(),at:new Date().toISOString()};cache();if(db&&uid)reflDoc().set({map:S.refl}).catch(function(){});closeG();render();setSync("Rebase started. 3 clean days to go.")});
    });
  }
