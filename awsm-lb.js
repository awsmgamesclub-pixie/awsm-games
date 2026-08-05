/* ================= AWSMLB — shared global-leaderboard client (games) =================
   Combined board across all games, stored in a free no-signup JSON blob.
   Include in a game with:  <script src="./awsm-lb.js"></script>
   Then on game over / win:  AWSMLB.record('Game Name', score)
   (record() prompts for 3 initials, then submits. score<=0 is ignored.)
   The blob URL is shared with the arcade viewer in index.html — keep them the same. */
(function(){
  var URL = 'https://jsonblob.com/api/jsonBlob/019fd0c7-67f0-7a99-bc61-c6544f03d285';
  var MAX = 200;

  // Inject the initials-entry overlay styles once, so any game works standalone.
  function injectStyle(){
    if(document.getElementById('awsmIniStyle')) return;
    var s = document.createElement('style'); s.id = 'awsmIniStyle';
    s.textContent =
      '#awsmIni{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(4,4,12,.86);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);font-family:system-ui,-apple-system,sans-serif}' +
      '#awsmIni .ic{width:100%;max-width:340px;text-align:center;background:linear-gradient(180deg,#170a2e,#0d0720);border:1px solid rgba(255,214,10,.35);border-radius:16px;padding:22px 20px 20px;box-shadow:0 24px 70px rgba(0,0,0,.6)}' +
      '#awsmIni .t{font:900 18px system-ui;letter-spacing:2px;color:#fff;margin:0 0 4px}' +
      '#awsmIni .s{font:700 14px system-ui;color:#ffd60a;margin:0 0 16px}' +
      '#awsmIni input{width:170px;text-align:center;text-transform:uppercase;letter-spacing:10px;font:800 30px ui-monospace,Menlo,monospace;color:#fff;caret-color:#22e7ff;background:rgba(255,255,255,.06);border:1px solid rgba(34,231,255,.4);border-radius:10px;padding:10px 6px;outline:none}' +
      '#awsmIni input:focus{border-color:#22e7ff;box-shadow:0 0 14px rgba(34,231,255,.3)}' +
      '#awsmIni .btns{display:flex;gap:10px;margin-top:16px}' +
      '#awsmIni button{flex:1;border:none;border-radius:10px;cursor:pointer;padding:11px 0;font:800 14px system-ui;letter-spacing:1px}' +
      '#awsmIni .ok{background:#ffd60a;color:#2a2000}' +
      '#awsmIni .skip{background:rgba(255,255,255,.08);color:#cdd3e0}';
    (document.head || document.documentElement).appendChild(s);
  }

  function get(){
    return fetch(URL, { cache:'no-store' })
      .then(function(r){ return r.ok ? r.json() : {scores:[]}; })
      .then(function(d){ return (d && d.scores) || []; })
      .catch(function(){ return []; });
  }
  function put(scores){
    return fetch(URL, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scores:scores}) })
      .catch(function(){});
  }
  function clean(ini){ return (ini||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,3); }

  function submit(game, score, initials){
    score = Math.max(0, Math.round(score||0));
    initials = clean(initials) || 'AAA';
    return get().then(function(scores){
      scores.push({ i:initials, g:String(game||'?'), s:score, t:Date.now() });
      scores.sort(function(a,b){ return b.s - a.s; });
      if(scores.length > MAX) scores = scores.slice(0, MAX);
      return put(scores).then(function(){ return scores; });
    });
  }

  function askInitials(score, game){
    injectStyle();
    return new Promise(function(resolve){
      var ov = document.createElement('div'); ov.id = 'awsmIni';
      ov.innerHTML =
        '<div class="ic">' +
          '<p class="t">NEW SCORE</p>' +
          '<p class="s">' + (game ? game + ' · ' : '') + (score|0) + '</p>' +
          '<input maxlength="3" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="AAA" aria-label="Your initials">' +
          '<div class="btns"><button class="skip" type="button">SKIP</button><button class="ok" type="button">ADD</button></div>' +
        '</div>';
      document.body.appendChild(ov);
      var inp = ov.querySelector('input');
      function done(v){ if(ov.parentNode) ov.parentNode.removeChild(ov); resolve(v); }
      inp.addEventListener('input', function(){ inp.value = clean(inp.value); });
      inp.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); done(clean(inp.value)||'AAA'); } });
      ov.querySelector('.ok').addEventListener('click', function(){ done(clean(inp.value)||'AAA'); });
      ov.querySelector('.skip').addEventListener('click', function(){ done(null); });
      setTimeout(function(){ try{ inp.focus(); }catch(e){} }, 30);
    });
  }

  function record(game, score){
    score = Math.max(0, Math.round(score||0));
    if(score <= 0) return Promise.resolve(null);
    return askInitials(score, game).then(function(ini){
      if(ini == null) return null;
      return submit(game, score, ini);
    });
  }

  window.AWSMLB = { get:get, submit:submit, askInitials:askInitials, record:record, url:URL };
})();
