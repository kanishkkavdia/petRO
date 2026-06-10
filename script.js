Here are the fully updated, complete files. I have integrated the **follow-up window**, **API usage tracking**, **new emotions** (`loving`, `surprised`, `shy`), **occasional idle wandering**, and **Hindi pronunciation detection** (automatically swapping to a Hindi voice if Devanagari text is detected).

### 1. `index.html`

Copy and replace your entire `index.html` file with this:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#090d18">
<link rel="manifest" href="manifest.json">
<title>petRO</title>
<link rel="apple-touch-icon" href="https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/robot/default/48px.svg">
<style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;900&family=Space+Mono:wght@400;700&display=swap');

:root {
  --bg:      #090d18;
  --surface: #101623;
  --card:    #141e30;
  --border:  #1c2a3e;
  --theme-color: #3b9eff;
  --theme-glow:  rgba(59,158,255,0.4);
  --blue:    #3b9eff;
  --green:   #22d3a0;
  --red:     #ff5f6d;
  --yellow:  #ffd23f;
  --purple:  #a855f7;
  --text:    #ddeeff;
  --muted:   #3d5470;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
html { background: var(--bg); scroll-behavior: smooth; transition: background 0.5s; }
body { background: var(--bg); color: var(--text); font-family: 'Nunito', sans-serif; overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; }

/* ── TOPBAR ── */
#topbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 14px;
  background: rgba(9,13,24,0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(28,42,62,0.7); height: 44px;
}
.logo { font-family: 'Space Mono', monospace; font-size: 1rem; font-weight: 700; color: var(--text); letter-spacing: -1px; }
.logo span { color: var(--theme-color); transition: color 0.3s; }
.topbar-right { display: flex; gap: 6px; align-items: center; }
.badge {
  font-family: 'Space Mono', monospace; font-size: 0.55rem; font-weight: 700;
  letter-spacing: 0.8px; text-transform: uppercase; padding: 3px 9px; border-radius: 20px;
  border: 1px solid var(--border); background: var(--surface); white-space: nowrap;
  transition: all 0.25s; cursor: pointer;
}
.badge.ble-off  { color: var(--red);   border-color: rgba(255,95,109,0.25); }
.badge.ble-on   { color: var(--green); border-color: rgba(34,211,160,0.3);  }
.badge.ble-spin { color: var(--theme-color);  border-color: var(--theme-glow);  animation: badge-pulse 1s infinite; cursor: default; }
.badge.mic-off  { color: var(--muted); }
.badge.mic-on   { color: var(--theme-color);  border-color: var(--theme-glow);  animation: badge-pulse 0.9s infinite; }
.badge.mic-wake { color: var(--green); border-color: rgba(34,211,160,0.3);  }
.badge.key-set  { color: var(--yellow); border-color: rgba(255,210,63,0.3); }
.badge.key-missing { color: var(--red); border-color: rgba(255,95,109,0.3); animation: badge-pulse 1.5s infinite; }
@keyframes badge-pulse { 0%,100%{box-shadow:0 0 0 0 var(--theme-glow)} 50%{box-shadow:0 0 0 5px rgba(59,158,255,0)} }

/* ── SCREEN 1: FACE ── */
#faceScreen {
  position: relative; width: 100%; height: 100svh; min-height: 100svh;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  overflow: hidden;
  background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.01) 3px, rgba(255,255,255,0.01) 4px), var(--bg);
}
#faceScreen::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 55% at 50% 48%, var(--theme-glow) 0%, transparent 70%);
  pointer-events: none; transition: background 0.5s;
}
.face-center { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; padding-top: 44px; }
.face-wrap { width: min(380px, 92vw); flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative; }
.face-wrap svg { width: 100%; height: auto; display: block; overflow: visible; transition: all 0.3s; }

/* ── Listening Status Text (Replaces Overlay) ── */
#listeningStatus {
  position: absolute; bottom: -30px; left: 50%; transform: translateX(-50%);
  font-size: 0.8rem; font-weight: 700; color: var(--theme-color);
  opacity: 0; transition: opacity 0.3s; pointer-events: none;
  background: var(--card); padding: 4px 12px; border-radius: 12px; border: 1px solid var(--theme-color);
  box-shadow: 0 0 10px var(--theme-glow); white-space: nowrap;
}

.scroll-hint {
  position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  opacity: 0.35; animation: hint-bob 2s ease-in-out infinite; pointer-events: none;
  font-size: 0.55rem; letter-spacing: 1px; text-transform: uppercase; color: var(--muted);
}
.scroll-hint svg { width: 20px; height: 20px; fill: none; stroke: var(--muted); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
@keyframes hint-bob { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} }

/* ── SCREEN 2: CONTROLS ── */
#controlsScreen { width: 100%; min-height: 100svh; background: var(--surface); border-top: 2px solid var(--border); display: flex; flex-direction: column; padding: 12px 0 env(safe-area-inset-bottom,12px); }
.section-label { font-family:'Space Mono',monospace; font-size:0.6rem; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--muted); padding:0 14px 8px; border-bottom:1px solid var(--border); margin-bottom:14px; }
@media (orientation:landscape) {
  .face-center { flex-direction:column; justify-content:center; align-items:center; padding:0; height:100svh; width:100vw; }
  .face-wrap { width:min(100vw,150vh); height:auto; max-width:100vw; max-height:100vh; padding:10vh 4vw; }
  #controlsScreen { flex-direction:row; align-items:stretch; gap:0; min-height:100svh; padding:0; }
  #dpadSection { width:260px; flex-shrink:0; border-right:1px solid var(--border); padding:14px 12px; overflow-y:auto; display:flex; flex-direction:column; }
  #chatSection { flex:1; min-height:100svh; }
}

/* ── D-PAD & MINI PETRO ── */
#normalControls { display: flex; flex-direction: column; gap: 14px; }
.dpad { display:grid; grid-template-areas:". up ." "left stop right" ". down ."; gap:8px; justify-content:center; }
.dp { width:58px; height:58px; border-radius:16px; border:1px solid var(--border); background:var(--card); color:var(--text); font-size:1.3rem; cursor:pointer; transition:all 0.1s; display:flex; align-items:center; justify-content:center; user-select:none; -webkit-user-select:none; touch-action: manipulation; }
.dp:active,.dp.pressed { background:var(--theme-glow); border-color:var(--theme-color); color:var(--theme-color); transform:scale(0.9); }
.dp[data-d=forward]  { grid-area:up; }
.dp[data-d=backward] { grid-area:down; }
.dp[data-d=left]     { grid-area:left; }
.dp[data-d=right]    { grid-area:right; }
.dp[data-d=stop]     { grid-area:stop; background:rgba(255,95,109,0.07); color:var(--red); border-color:rgba(255,95,109,0.25); }
.dp[data-d=stop]:active { background:rgba(255,95,109,0.2); border-color:var(--red); }
.action-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.act { padding:12px 6px; border-radius:14px; border:1px solid var(--border); background:var(--card); color:var(--text); font-family:'Nunito',sans-serif; font-size:0.82rem; font-weight:700; cursor:pointer; transition:all 0.1s; display:flex; align-items:center; justify-content:center; gap:5px; touch-action: manipulation; }
.act:active { background:var(--theme-glow); border-color:var(--theme-color); color:var(--theme-color); transform:scale(0.96); }

/* Mini petRO for YouTube Mode */
#miniPetroArea { display:none; flex-direction:column; align-items:center; justify-content:center; flex:1; gap:15px; text-align:center; opacity:0; transition: opacity 0.5s; }
.mini-petro-svg { width: 120px; height: 120px; animation: badge-pulse 2s infinite; border-radius: 50%; background: var(--card); border: 2px solid var(--theme-color); padding: 10px; }
.mini-title { font-size: 1.1rem; font-weight: 700; color: var(--theme-color); }
.mini-sub { font-size: 0.8rem; color: var(--muted); padding: 0 10px; }

/* ── CHAT ── */
#chatSection { display:flex; flex-direction:column; min-height:0; position: relative; }
@media (orientation:portrait)  { #chatSection { height:55vh; } }
@media (orientation:landscape) { #chatSection { height:100svh; } }
#messages { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:9px; scroll-behavior:smooth; }
#messages::-webkit-scrollbar { width:2px; }
#messages::-webkit-scrollbar-thumb { background:var(--border); }
.msg { display:flex; flex-direction:column; gap:2px; animation:fadein 0.18s ease; }
@keyframes fadein { from{opacity:0;transform:translateY(4px)} }
.msg.user { align-items:flex-end; }
.msg.bot  { align-items:flex-start; }
.msg-label { font-size:0.59rem; color:var(--muted); padding:0 5px; font-weight:700; }
.msg-bubble { max-width:85%; padding:8px 12px; border-radius:14px; font-size:0.83rem; line-height:1.45; word-break:break-word; }
.msg.user .msg-bubble { background:var(--theme-color); color:#fff; border-bottom-right-radius:4px; }
.msg.bot  .msg-bubble { background:var(--card); border:1px solid var(--border); border-bottom-left-radius:4px; }
.actions-chip { font-size:0.59rem; color:var(--yellow); background:rgba(255,210,63,0.08); border:1px solid rgba(255,210,63,0.2); border-radius:8px; padding:2px 8px; }
.typing-wrap { display:flex; gap:4px; padding:9px 12px; background:var(--card); border:1px solid var(--border); border-radius:14px; border-bottom-left-radius:4px; width:fit-content; }
.typing-dot { width:5px; height:5px; background:var(--muted); border-radius:50%; animation:bounce 1.2s ease-in-out infinite; }
.typing-dot:nth-child(2){animation-delay:.2s} .typing-dot:nth-child(3){animation-delay:.4s}
@keyframes bounce { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-4px);opacity:1} }
.sugs { display:flex; gap:5px; flex-wrap:wrap; padding:6px 10px; border-top:1px solid var(--border); background:var(--surface); flex-shrink:0; }
.sug { font-size:0.67rem; font-family:'Nunito',sans-serif; padding:3px 9px; border-radius:20px; border:1px solid var(--border); background:transparent; color:var(--muted); cursor:pointer; transition:all 0.12s; white-space:nowrap; }
.sug:hover,.sug:active { border-color:var(--theme-color); color:var(--theme-color); }
#inputBar { display:flex; gap:6px; padding:8px 10px; border-top:1px solid var(--border); background:var(--card); flex-shrink:0; }
#inputBar input[type=text] { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:10px; color:var(--text); font-family:'Nunito',sans-serif; font-size:0.83rem; padding:8px 12px; outline:none; transition:border-color 0.15s; }
#inputBar input[type=text]:focus { border-color:var(--theme-color); }
#inputBar input[type=text]::placeholder { color:var(--muted); }
.send-btn { width:38px; height:38px; border-radius:10px; border:none; background:var(--theme-color); color:#fff; font-size:1rem; cursor:pointer; transition:all 0.12s; display:flex; align-items:center; justify-content:center; }
.send-btn:active { transform:scale(0.9); }
.icon-btn { width:38px; height:38px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--muted); font-size:1rem; cursor:pointer; transition:all 0.12s; display:flex; align-items:center; justify-content:center; }
.icon-btn.speaking { color:var(--theme-color); border-color:var(--theme-glow); animation:badge-pulse 0.8s infinite; }
.icon-btn:active { transform:scale(0.9); }

/* ── SETTINGS MODAL ── */
#settingsModal {
  position:fixed; inset:0; z-index:300;
  background:rgba(9,13,24,0.92); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  display:flex; align-items:flex-end; justify-content:center;
  opacity:0; pointer-events:none; transition:opacity 0.25s;
}
#settingsModal.open { opacity:1; pointer-events:all; }
.settings-sheet {
  width:100%; max-width:520px; background:var(--surface);
  border-radius:20px 20px 0 0; border:1px solid var(--border); border-bottom:none;
  padding:20px 18px 32px; display:flex; flex-direction:column; gap:18px;
  transform:translateY(60px); transition:transform 0.3s cubic-bezier(0.34,1.2,0.64,1);
  max-height:85svh; overflow-y:auto;
}
#settingsModal.open .settings-sheet { transform:translateY(0); }
.sheet-handle { width:36px; height:4px; background:var(--border); border-radius:2px; margin:0 auto -6px; }
.settings-title { font-family:'Space Mono',monospace; font-size:0.9rem; font-weight:700; color:var(--text); }
.settings-row { display:flex; flex-direction:column; gap:6px; }
.settings-label { font-size:0.72rem; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:1px; }
.settings-input-wrap { position:relative; display:flex; align-items:center; }
.settings-input {
  flex:1; background:var(--card); border:1px solid var(--border); border-radius:10px;
  color:var(--text); font-family:'Space Mono',monospace; font-size:0.78rem;
  padding:10px 12px; outline:none; transition:border-color 0.15s;
}
.settings-input[type="password"] { padding-right: 40px; }
.settings-input:focus { border-color:var(--theme-color); }
.settings-input::placeholder { color:var(--muted); font-family:'Nunito',sans-serif; }
.eye-btn { position:absolute; right:10px; background:none; border:none; color:var(--muted); cursor:pointer; font-size:1rem; padding:0; }
.save-btn { padding:10px 20px; border-radius:10px; border:none; background:var(--theme-color); color:#fff; font-family:'Nunito',sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; transition:all 0.12s; }
.save-btn:active { transform:scale(0.97); }
.key-status { font-size:0.75rem; padding:6px 10px; border-radius:8px; }
.key-status.ok  { background:rgba(34,211,160,0.1); color:var(--green); border:1px solid rgba(34,211,160,0.2); }
.key-status.bad { background:rgba(255,95,109,0.1); color:var(--red);   border:1px solid rgba(255,95,109,0.2); }
.ble-info { font-size:0.78rem; color:var(--muted); background:var(--card); border:1px solid var(--border); border-radius:8px; padding:8px 12px; font-family:'Space Mono',monospace; }
.settings-divider { border:none; border-top:1px solid var(--border); margin:0; }
.danger-btn { padding:10px 20px; border-radius:10px; border:1px solid rgba(255,95,109,0.3); background:rgba(255,95,109,0.08); color:var(--red); font-family:'Nunito',sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; transition:all 0.12s; }
.danger-btn:active { background:rgba(255,95,109,0.2); }
.close-sheet { align-self:flex-end; background:none; border:1px solid var(--border); color:var(--muted); border-radius:8px; padding:5px 12px; font-size:0.75rem; cursor:pointer; font-family:'Nunito',sans-serif; }

/* ── TOAST ── */
#toast { position:fixed; bottom:14px; left:50%; transform:translateX(-50%) translateY(70px); background:var(--card); border:1px solid var(--border); border-radius:12px; padding:8px 16px; font-size:0.8rem; transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1); z-index:999; pointer-events:none; max-width:300px; text-align:center; }
#toast.show { transform:translateX(-50%) translateY(0); }

/* ── MEMORY INDICATOR ── */
#memoryPill { font-size:0.6rem; color:var(--muted); text-align:center; padding:2px 8px; opacity:0.6; }

/* ── YOUTUBE API OVERLAY ── */
#ytContainer {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  background: var(--surface); z-index: 150; display: none; flex-direction: column;
}
#ytHeader { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--card); border-bottom: 1px solid var(--border); }
#ytPlayerDiv { flex: 1; border: none; width: 100%; }
.close-yt-btn { background: var(--red); color: white; border: none; padding: 5px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; }
</style>
<script src="https://www.youtube.com/iframe_api"></script>
</head>
<body>

<div id="topbar">
  <div class="logo">pet<span>RO</span></div>
  <div class="topbar-right">
    <div class="badge"            id="fsBtn"     onclick="toggleFullscreen()"   title="Toggle Fullscreen">⛶ FS</div>
    <div class="badge mic-off"    id="micBadge"  onclick="toggleAlwaysOnMic()"  title="Toggle wake word mic">🎤 OFF</div>
    <div class="badge key-missing" id="keyBadge" onclick="openSettings()"       title="Gemini API key">🔑 KEY</div>
    <div class="badge ble-off"    id="bleBtn"    onclick="toggleBLE()"          title="Connect to petRO BLE">⚫ BLE</div>
    <div class="badge"            id="settingsBtn" onclick="openSettings()"     style="color:var(--muted)">⚙</div>
  </div>
</div>

<div id="faceScreen">
  <div class="face-center">
    <div class="face-wrap">
      <svg id="faceSVG" viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ig1" cx="38%" cy="32%" r="62%"><stop id="stop1-1" offset="0%" stop-color="#7dd3ff"/><stop id="stop1-2" offset="100%" stop-color="#1a6fd4"/></radialGradient>
          <radialGradient id="ig2" cx="38%" cy="32%" r="62%"><stop id="stop2-1" offset="0%" stop-color="#7dd3ff"/><stop id="stop2-2" offset="100%" stop-color="#1a6fd4"/></radialGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <clipPath id="lcl"><ellipse cx="65" cy="88" rx="64" ry="64"/></clipPath>
          <clipPath id="rcl"><ellipse cx="235" cy="88" rx="64" ry="64"/></clipPath>
          <clipPath id="mouthClip"><rect x="95" y="148" width="110" height="44"/></clipPath>
        </defs>
        
        <g id="earsGroup" opacity="0" style="transition: opacity 0.3s; pointer-events: none;">
           <g class="ear-theme ear-default ear-starwars" style="display:none;">
             <line x1="-15" y1="88" x2="-25" y2="40" stroke="var(--theme-color)" stroke-width="4" stroke-linecap="round"/>
             <circle cx="-25" cy="40" r="8" fill="var(--theme-color)"/>
             <line x1="315" y1="88" x2="325" y2="40" stroke="var(--theme-color)" stroke-width="4" stroke-linecap="round"/>
             <circle cx="325" cy="40" r="8" fill="var(--theme-color)"/>
           </g>
           <g class="ear-theme ear-dog" style="display:none;">
             <path d="M -10 60 Q -30 20 -40 80 Q -30 120 -10 100 Z" fill="#b07a48"/>
             <path d="M 310 60 Q 330 20 340 80 Q 330 120 310 100 Z" fill="#b07a48"/>
           </g>
           <g class="ear-theme ear-monkey" style="display:none;">
             <circle cx="-20" cy="88" r="25" fill="#5d4037" />
             <circle cx="-20" cy="88" r="15" fill="#a1887f" />
             <circle cx="320" cy="88" r="25" fill="#5d4037" />
             <circle cx="320" cy="88" r="15" fill="#a1887f" />
           </g>
           <g class="ear-theme ear-terminator ear-transformer" style="display:none;">
             <rect x="-30" y="68" width="25" height="40" fill="#555" stroke="var(--theme-color)" stroke-width="2" rx="4"/>
             <rect x="305" y="68" width="25" height="40" fill="#555" stroke="var(--theme-color)" stroke-width="2" rx="4"/>
             <line x1="-30" y1="88" x2="-45" y2="88" stroke="var(--theme-color)" stroke-width="3"/>
             <line x1="330" y1="88" x2="345" y2="88" stroke="var(--theme-color)" stroke-width="3"/>
           </g>
           <path d="M -50 78 Q -60 88 -50 98 M -60 68 Q -75 88 -60 108" fill="none" stroke="var(--theme-color)" stroke-width="3" stroke-linecap="round" class="ear-wave"/>
           <path d="M 350 78 Q 360 88 350 98 M 360 68 Q 375 88 360 108" fill="none" stroke="var(--theme-color)" stroke-width="3" stroke-linecap="round" class="ear-wave"/>
        </g>

        <ellipse id="lGlow" cx="65"  cy="88" rx="68" ry="68" fill="none" stroke="#3b9eff" stroke-width="1.5" opacity="0.2" filter="url(#glow)"/>
        <ellipse cx="65"  cy="88" rx="64" ry="64" fill="#d8eeff" id="lWhite"/>
        <g clip-path="url(#lcl)">
          <ellipse id="lIris"  cx="65" cy="88" rx="42" ry="42" fill="url(#ig1)"/>
          <ellipse id="lPupil" cx="65" cy="88" rx="22" ry="22" fill="#060f1e"/>
          <ellipse id="lHL1"   cx="54" cy="75" rx="8.5" ry="8.5" fill="white" opacity="0.9"/>
          <ellipse id="lHL2"   cx="76" cy="79" rx="3.5" ry="3.5" fill="white" opacity="0.5"/>
          <rect id="lLidTop" x="0"   y="-65" width="140" height="85" fill="#141e30" rx="4"/>
          <rect id="lLidBot" x="0"   y="200" width="140" height="65" fill="#141e30"/>
          <line id="lBrow" x1="10" y1="35" x2="120" y2="35" stroke="#141e30" stroke-width="0" stroke-linecap="round"/>
        </g>
        <ellipse cx="65"  cy="88" rx="64" ry="64" fill="none" stroke="#3b9eff" stroke-width="2" opacity="0.55" id="lRim"/>
        
        <ellipse id="rGlow" cx="235" cy="88" rx="68" ry="68" fill="none" stroke="#3b9eff" stroke-width="1.5" opacity="0.2" filter="url(#glow)"/>
        <ellipse cx="235" cy="88" rx="64" ry="64" fill="#d8eeff" id="rWhite"/>
        <g clip-path="url(#rcl)">
          <ellipse id="rIris"  cx="235" cy="88" rx="42" ry="42" fill="url(#ig2)"/>
          <ellipse id="rPupil" cx="235" cy="88" rx="22" ry="22" fill="#060f1e"/>
          <ellipse id="rHL1"   cx="224" cy="75" rx="8.5" ry="8.5" fill="white" opacity="0.9"/>
          <ellipse id="rHL2"   cx="246" cy="79" rx="3.5" ry="3.5" fill="white" opacity="0.5"/>
          <rect id="rLidTop" x="160" y="-65" width="140" height="85" fill="#141e30" rx="4"/>
          <rect id="rLidBot" x="160" y="200" width="140" height="65" fill="#141e30"/>
          <line id="rBrow" x1="180" y1="35" x2="290" y2="35" stroke="#141e30" stroke-width="0" stroke-linecap="round"/>
        </g>
        <ellipse cx="235" cy="88" rx="64" ry="64" fill="none" stroke="#3b9eff" stroke-width="2" opacity="0.55" id="rRim"/>
        
        <g id="mouthGroup" clip-path="url(#mouthClip)" style="transition: opacity 0.3s;">
          <rect x="95" y="152" width="110" height="34" rx="17" fill="#0d1627"/>
          <path id="mouthPath" d="M 105 169 Q 150 182 195 169" fill="none" stroke="#3b9eff" stroke-width="3.5" stroke-linecap="round"/>
        </g>
        <rect x="95" y="152" width="110" height="34" rx="17" fill="none" stroke="#3b9eff" stroke-width="1.2" opacity="0.3" id="mouthRim" style="transition: opacity 0.3s;"/>

        <g id="propsLayer" style="pointer-events: none; z-index: 50;">
          <g id="prop-apple" class="prop-item" style="opacity:0; transition:opacity 0.4s; transform-origin: center;"><path d="M 150 175 C 130 175, 130 145, 150 155 C 170 145, 170 175, 150 175 Z" fill="#ff5f6d"/><path d="M 150 155 Q 155 145 160 145" fill="none" stroke="#22d3a0" stroke-width="2"/></g>
          <g id="prop-book" class="prop-item" style="opacity:0; transition:opacity 0.4s;"><path d="M 110 180 L 150 190 L 190 180 L 190 150 L 150 160 L 110 150 Z" fill="#3b9eff" stroke="#fff" stroke-width="1.5"/><path d="M 150 190 L 150 160" stroke="#fff" stroke-width="1.5"/></g>
          <g id="prop-dumbbell" class="prop-item" style="opacity:0; transition:opacity 0.4s;"><rect x="110" y="165" width="80" height="6" fill="#a855f7" rx="3"/><rect x="100" y="153" width="15" height="30" fill="#3d5470" rx="2"/><rect x="185" y="153" width="15" height="30" fill="#3d5470" rx="2"/></g>
          <g id="prop-laptop" class="prop-item" style="opacity:0; transition:opacity 0.4s;"><rect x="120" y="145" width="60" height="35" fill="#3d5470" rx="3"/><rect x="125" y="150" width="50" height="25" fill="#ddeeff" rx="1"/><polygon points="100,185 200,185 180,180 120,180" fill="#a855f7"/></g>
        </g>

        <g id="theme-overlays">
          <g id="theme-dog" style="opacity: 0; transition: opacity 0.3s; pointer-events: none;"><path d="M 40 30 C -20 30, -30 160, 10 180 C 40 160, 50 100, 55 50 Z" fill="#b07a48" /><path d="M 260 30 C 320 30, 330 160, 290 180 C 260 160, 250 100, 245 50 Z" fill="#b07a48" /><path d="M 135 125 Q 150 120 165 125 L 155 140 Q 150 145 145 140 Z" fill="#1a1a1a" /><circle cx="146" cy="128" r="3" fill="#ffffff" opacity="0.4"/></g>
          <g id="theme-monkey" style="opacity: 0; transition: opacity 0.3s; pointer-events: none;"><circle cx="10" cy="100" r="32" fill="#5d4037" /><circle cx="15" cy="100" r="18" fill="#a1887f" /><circle cx="290" cy="100" r="32" fill="#5d4037" /><circle cx="285" cy="100" r="18" fill="#a1887f" /><path d="M 130 18 Q 150 -15 170 18 Q 160 25 150 25 Q 140 25 130 18 Z" fill="#5d4037" /></g>
          <g id="theme-terminator" style="opacity: 0; transition: opacity 0.3s; pointer-events: none;"><path d="M 10 80 L 30 40 L 70 20 L 60 90 Z" fill="#333" stroke="#111" stroke-width="2" opacity="0.9"/><line x1="30" y1="40" x2="10" y2="100" stroke="#111" stroke-width="3" /><path d="M 130 5 L 170 5 L 160 30 L 140 30 Z" fill="#555" stroke="#222" stroke-width="2" /><ellipse cx="235" cy="88" rx="66" ry="66" fill="none" stroke="#ff0000" stroke-width="6" opacity="0.8"/><circle cx="235" cy="88" r="34" fill="none" stroke="#ff0000" stroke-width="2" opacity="0.6"/><line x1="235" y1="20" x2="235" y2="50" stroke="#ff0000" stroke-width="2" opacity="0.7"/><line x1="235" y1="126" x2="235" y2="156" stroke="#ff0000" stroke-width="2" opacity="0.7"/><line x1="167" y1="88" x2="197" y2="88" stroke="#ff0000" stroke-width="2" opacity="0.7"/><line x1="273" y1="88" x2="303" y2="88" stroke="#ff0000" stroke-width="2" opacity="0.7"/></g>
          <g id="theme-starwars" style="opacity: 0; transition: opacity 0.3s; pointer-events: none;"><path d="M 30 25 Q 150 -15 270 25 L 260 40 Q 150 5 40 40 Z" fill="#0055ff" /><rect x="130" y="5" width="40" height="15" fill="#e0e0e0" /><circle cx="150" cy="30" r="18" fill="#222" stroke="#silver" stroke-width="3" /><circle cx="150" cy="30" r="6" fill="#ff0000" /><rect x="15" y="110" width="20" height="50" fill="#0055ff" rx="4" /><rect x="265" y="110" width="20" height="50" fill="#0055ff" rx="4" /><line x1="15" y1="120" x2="35" y2="120" stroke="#111" stroke-width="2"/><line x1="265" y1="120" x2="285" y2="120" stroke="#111" stroke-width="2"/></g>
          <g id="theme-transformer" style="opacity: 0; transition: opacity 0.3s; pointer-events: none;"><polygon points="140,5 160,5 160,40 150,60 140,40" fill="#e0e0e0" stroke="#888" stroke-width="2" /><polygon points="145,15 155,15 155,35 150,45 145,35" fill="#0044cc" /><path d="M 20 15 L 55 5 L 65 40 L 10 120 L 10 40 Z" fill="#0044cc" stroke="#003399" stroke-width="2"/><path d="M 280 15 L 245 5 L 235 40 L 290 120 L 290 40 Z" fill="#0044cc" stroke="#003399" stroke-width="2"/><rect x="0" y="45" width="12" height="65" fill="#e0e0e0" stroke="#888" stroke-width="1"/><rect x="288" y="45" width="12" height="65" fill="#e0e0e0" stroke="#888" stroke-width="1"/><path d="M 80 145 L 150 120 L 220 145 L 210 210 L 150 220 L 90 210 Z" fill="#b0b5ba" stroke="#555" stroke-width="3" /><line x1="100" y1="155" x2="200" y2="155" stroke="#666" stroke-width="4" stroke-linecap="round"/><line x1="105" y1="170" x2="195" y2="170" stroke="#666" stroke-width="4" stroke-linecap="round"/><line x1="110" y1="185" x2="190" y2="185" stroke="#666" stroke-width="4" stroke-linecap="round"/></g>
        </g>

        <g id="sleepZZZ" opacity="0"><text id="z1" x="248" y="40" font-family="Nunito" font-size="16" font-weight="900" fill="#a855f7">z</text><text id="z2" x="262" y="24" font-family="Nunito" font-size="20" font-weight="900" fill="#a855f7" opacity="0.7">z</text><text id="z3" x="278" y="6"  font-family="Nunito" font-size="24" font-weight="900" fill="#a855f7" opacity="0.5">Z</text></g>
        <g id="rippleGroup" opacity="0"><circle cx="150" cy="190" r="5" fill="#3b9eff"/><circle id="rp1" cx="150" cy="190" r="5" fill="none" stroke="#3b9eff" stroke-width="2" opacity="0"/><circle id="rp2" cx="150" cy="190" r="5" fill="none" stroke="#3b9eff" stroke-width="2" opacity="0"/></g>
        <g id="tearGroup" opacity="0"><ellipse id="tearL" cx="52"  cy="128" rx="4" ry="6" fill="#7dd3ff" opacity="0.8"/><ellipse id="tearR" cx="248" cy="128" rx="4" ry="6" fill="#7dd3ff" opacity="0.8"/></g>
      </svg>
      <div id="listeningStatus">Listening...</div>
    </div>
  </div>
  <div class="scroll-hint" onclick="document.getElementById('controlsScreen').scrollIntoView({behavior:'smooth'})">
    <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg> Controls
  </div>
</div>

<div id="controlsScreen">
  <div id="dpadSection">
    
    <div id="normalControls">
      <div class="section-label">🕹 Direct Controls</div>
      <div class="dpad">
        <button class="dp" data-d="forward"  onpointerdown="startDirectMove('F')" onpointerup="stopDirectMove()" onpointerleave="stopDirectMove()">▲</button>
        <button class="dp" data-d="left"     onpointerdown="startDirectMove('L')" onpointerup="stopDirectMove()" onpointerleave="stopDirectMove()">◀</button>
        <button class="dp" data-d="stop"     onclick="stopDirectMove()">■</button>
        <button class="dp" data-d="right"    onpointerdown="startDirectMove('R')" onpointerup="stopDirectMove()" onpointerleave="stopDirectMove()">▶</button>
        <button class="dp" data-d="backward" onpointerdown="startDirectMove('B')" onpointerup="stopDirectMove()" onpointerleave="stopDirectMove()">▼</button>
      </div>
      <div class="action-grid">
        <button class="act" onclick="doAction('dance')">💃 Dance</button>
        <button class="act" onclick="doAction('nod')">😊 Nod</button>
        <button class="act" onclick="doAction('wander')">🗺️ Wander</button>
        <button class="act" onclick="clearChat()">🗑 Clear</button>
      </div>
      <div id="memoryPill">Memory: 0 / 50 msgs</div>
      <button class="act" onclick="enableMotionSensors()" id="gyroBtn" style="margin-top:10px; width:100%;">🧭 Enable Motion Sync</button>
    </div>

    <div id="miniPetroArea">
      <div class="section-label">🎬 Media Mode</div>
      <svg class="mini-petro-svg" viewBox="0 0 100 100">
        <circle cx="30" cy="45" r="15" fill="var(--theme-color)"/>
        <circle cx="70" cy="45" r="15" fill="var(--theme-color)"/>
        <path d="M 35 70 Q 50 85 65 70" fill="none" stroke="var(--theme-color)" stroke-width="4" stroke-linecap="round"/>
      </svg>
      <div class="mini-title">petRO is chilling</div>
      <div class="mini-sub">D-Pad disabled while video plays.</div>
    </div>

  </div>

  <div id="chatSection">
    
    <div id="ytContainer">
      <div id="ytHeader">
        <span style="font-weight: bold; font-size: 0.8rem;">petRO Media Player</span>
        <button class="close-yt-btn" onclick="closeYouTube()">Close</button>
      </div>
      <div id="ytPlayerDiv"></div>
    </div>

    <div class="section-label" style="padding-top:14px;">💬 Chat with petRO</div>
    <div id="messages">
      <div class="msg bot">
        <div class="msg-label">petRO 🤖</div>
        <div class="msg-bubble">Hi! Tap <b>⚙ Settings</b> to customize me, add your API key, connect BLE and let's chat!</div>
      </div>
    </div>
    <div class="sugs">
      <button class="sug" style="color:var(--theme-color);border-color:var(--theme-glow);" onclick="manualCapture()">📸 Snap</button>
      <button class="sug" onclick="sendSug('Walk forward for 3 seconds then nod 2 times')">🏃 Combo Move</button>
      <button class="sug" onclick="sendSug('Call mom')">📞 Call</button>
      <button class="sug" onclick="sendSug('Play lofi hip hop on youtube')">🎵 Lofi</button>
      <button class="sug" onclick="sendSug('Draw a circle')">⭕ Circle</button>
    </div>
    <div id="uploadPreviewBar" style="display:none;padding:6px 12px;background:var(--card);border-top:1px solid var(--border);align-items:center;gap:10px;">
      <div style="position:relative;width:42px;height:42px;flex-shrink:0;">
        <img id="previewImg" src="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;border:1px solid var(--border);">
        <button onclick="clearUploadedImage()" style="position:absolute;top:-5px;right:-5px;background:var(--red);color:#fff;border:none;border-radius:50%;width:16px;height:16px;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:bold;">×</button>
      </div>
      <span style="font-size:0.75rem;color:var(--text);opacity:0.7;">Ready to send with next message…</span>
    </div>
    <div id="inputBar">
      <button class="icon-btn" onclick="document.getElementById('fileInput').click()" title="Attach image">🖼️</button>
      <input type="file" id="fileInput" accept="image/*" style="display:none;" onchange="handleFileUpload(event)">
      <input type="text" id="userInput" placeholder="Chat..." onkeydown="if(event.key==='Enter')sendChat()">
      <button class="icon-btn" id="ttsBtn" onclick="stopTTS()" title="Stop speaking">🔊</button>
      <button class="send-btn" id="sendBtn" onclick="sendChat()">➤</button>
    </div>
  </div>
</div>

<div id="settingsModal">
  <div class="settings-sheet">
    <div class="sheet-handle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div class="settings-title">⚙ Configuration</div>
      <button class="close-sheet" onclick="closeSettings()">✕ Close</button>
    </div>

    <div class="settings-row">
      <div class="settings-label">👤 Your Identity</div>
      <div class="settings-input-wrap">
        <input class="settings-input" type="text" id="userNameInput" placeholder="Your name">
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label">🎭 petRO Theme</div>
      <select id="themeSelect" class="settings-input" onchange="applyTheme()">
        <option value="default">Default (Friendly Robot)</option>
        <option value="dog">Robot Dog</option>
        <option value="terminator">Terminator T-800</option>
        <option value="monkey">Cheeky Monkey</option>
        <option value="starwars">Astromech (Star Wars)</option>
        <option value="transformer">Optimus Prime</option>
      </select>
      <button class="save-btn" onclick="savePersonalization()" style="margin-top:4px;">💾 Save Identity & Theme</button>
    </div>

    <hr class="settings-divider">

    <div class="settings-row">
      <div class="settings-label">🔑 Gemini API Key</div>
      <div class="settings-input-wrap">
        <input class="settings-input" type="password" id="apiKeyInput" placeholder="Paste Gemini API key…" autocomplete="off" spellcheck="false">
        <button class="eye-btn" id="eyeBtn" onclick="toggleKeyVisibility()">👁</button>
      </div>
      <div id="keyStatus" class="key-status bad">No key saved</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="save-btn" onclick="saveApiKey()">💾 Save Key</button>
        <button class="danger-btn" onclick="clearApiKey()">🗑 Remove Key</button>
      </div>
    </div>

    <hr class="settings-divider">

    <div class="settings-row">
      <div class="settings-label">⏱️ Follow-up Window</div>
      <select id="followUpSelect" class="settings-input">
        <option value="0">None (Say wake word every time)</option>
        <option value="5000">5 Seconds</option>
        <option value="10000">10 Seconds</option>
        <option value="15000">15 Seconds</option>
      </select>
    </div>

    <hr class="settings-divider">

    <div class="settings-row">
      <div class="settings-label">📊 API Usage & Cost Estimate</div>
      <div class="ble-info" id="usageBox" style="line-height: 1.5;">
        Requests: <b>0</b><br>
        Tokens: <b>0</b> In / <b>0</b> Out<br>
        Est. Cost: <b>$0.00000</b>
      </div>
      <button class="danger-btn" onclick="clearUsage()" style="margin-top:4px;">🗑 Reset Counters</button>
    </div>

    <hr class="settings-divider">

    <div class="settings-row">
      <div class="settings-label">📡 Bluetooth (BLE)</div>
      <div class="ble-info" id="bleInfoBox">Status: Not connected</div>
      <div style="display:flex;gap:8px;">
        <button class="save-btn" onclick="closeSettings();toggleBLE()">🔗 Connect BLE</button>
        <button class="danger-btn" onclick="disconnectBLE()">✂ Disconnect</button>
      </div>
    </div>
  </div>
</div>

<div id="toast"></div>
<video id="webcamView" autoplay playsinline style="display:none;"></video>
<canvas id="captureCanvas" style="display:none;"></canvas>

<script src="script.js"></script>
</body>
</html>

```

### 2. `script.js`

Copy and replace your entire `script.js` file with this:

```javascript
'use strict';

// ════════════════════════════════════════════════════════
// CONFIG & THEMES
// ════════════════════════════════════════════════════════
const WAKE_WORDS  = ['ok petro','okay petro','hey petro'];
const SLEEP_MS    = 5 * 60 * 1000; 
const MAX_HISTORY = 50;
const GEMINI_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const YT_API_KEY = 'AIzaSyC6Z2NDf7sy6oz35p5ZZfB8yYNVz5sJZZU';

const BLE_SERVICE  = '00001234-0000-1000-8000-00805f9b34fb';
const BLE_CMD_CHAR = '00005678-0000-1000-8000-00805f9b34fb';
const BLE_NAME     = 'petRO';

const DANCE_STEPS = [
  ['D', 1500], ['1', 600], ['2', 600], ['3', 400], ['4', 400], 
  ['L', 400], ['R', 400], ['7', 300], ['8', 300], ['S', 100]
];

const THEMES = {
  default: { color: '#3b9eff', bg: '#090d18', surface: '#101623', card: '#141e30', prompt: "You are petRO, a cute and playful robot. Be warm and fun." },
  dog: { color: '#ff9800', bg: '#1a1005', surface: '#2b1b0a', card: '#3d2610', prompt: "You are an energetic robot dog. Bark playfully." },
  terminator: { color: '#ff3333', bg: '#0a0000', surface: '#1a0000', card: '#2a0505', prompt: "You are a T-800 cyborg. Speak concisely." },
  monkey: { color: '#8bc34a', bg: '#0a1205', surface: '#13240a', card: '#1c360e', prompt: "You are a cheeky robot monkey. Make monkey sounds." },
  starwars: { color: '#00e5ff', bg: '#000814', surface: '#00122e', card: '#001c47', prompt: "You are a helpful astromech droid. Make beep-boops." },
  transformer: { color: '#f44336', bg: '#0d1017', surface: '#181d29', card: '#222a3b', prompt: "You are Optimus Prime, a noble Autobot." }
};

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════
let bleDevice = null, bleCmdChar = null, bleConnected = false, isBusy = false;
let currentEmotion = 'neutral', emotionResetTimer = null; 
let isSleeping = false, micState = 'off', alwaysOnMic = false;
let bgRecog = null, cmdRecog = null;
let inactTimer = null, idleMoveTimer = null, zzzAnim = null, blinkTimer = null;
let videoStream = null, currentUploadedImage = null;
let ttsActive = false, mouthTalkAnim = null, toastTimer = null;
let chatHistory = [], motionEnabled = false;

let isVideoPlaying = false, micSuspendedForVideo = false, grooveTimer = null;
let hardwareActive = false, hwTimeout = null;

let followUpActive = false, followUpTimeout = null;

// YouTube API variables
let ytPlayer = null;
let isYtApiReady = false;

window.onYouTubeIframeAPIReady = function() {
  isYtApiReady = true;
};

// ════════════════════════════════════════════════════════
// FULLSCREEN & API, THEME & USAGE LOGIC
// ════════════════════════════════════════════════════════
async function toggleFullscreen() {
  if (!document.fullscreenElement) { try { await document.documentElement.requestFullscreen(); if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(e => console.log('Orientation lock not supported')); } catch(e) { toast('⚠️ Fullscreen not supported'); }
  } else { try { await document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {} }
}

function getApiKey() { return localStorage.getItem('petro_gemini_key') || ''; }
function saveApiKey() { const v = document.getElementById('apiKeyInput').value.trim(); if (!v) { toast('⚠️ Paste key'); return; } localStorage.setItem('petro_gemini_key', v); updateKeyBadge(); toast('✅ Key saved!'); closeSettings(); }
function clearApiKey() { localStorage.removeItem('petro_gemini_key'); document.getElementById('apiKeyInput').value = ''; updateKeyBadge(); toast('🗑 Key removed'); }
function updateKeyBadge() { const k = getApiKey(), b = document.getElementById('keyBadge'), s = document.getElementById('keyStatus'); if (k) { b.className = 'badge key-set'; b.textContent = '🔑 KEY ✓'; s.className = 'key-status ok'; s.textContent = `Key saved: ${k.slice(0,8)}…`; } else { b.className = 'badge key-missing'; b.textContent = '🔑 KEY'; s.className = 'key-status bad'; s.textContent = 'No key saved'; } }
function toggleKeyVisibility() { const inp = document.getElementById('apiKeyInput'), btn = document.getElementById('eyeBtn'); if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; } else { inp.type = 'password'; btn.textContent = '👁'; } }

function loadPersonalization() { 
  document.getElementById('userNameInput').value = localStorage.getItem('petro_user_name') || ''; 
  document.getElementById('themeSelect').value = localStorage.getItem('petro_theme') || 'default'; 
  document.getElementById('followUpSelect').value = localStorage.getItem('petro_followup') || '0';
  applyTheme(); 
}

function savePersonalization() { 
  localStorage.setItem('petro_user_name', document.getElementById('userNameInput').value.trim()); 
  localStorage.setItem('petro_theme', document.getElementById('themeSelect').value); 
  localStorage.setItem('petro_followup', document.getElementById('followUpSelect').value);
  applyTheme(); toast('✅ Saved!'); 
}

function applyTheme() {
  const tId = document.getElementById('themeSelect').value || 'default', t = THEMES[tId], root = document.documentElement;
  root.style.setProperty('--theme-color', t.color); root.style.setProperty('--bg', t.bg); root.style.setProperty('--surface', t.surface); root.style.setProperty('--card', t.card);
  document.getElementById('stop1-2').setAttribute('stop-color', t.color); document.getElementById('stop2-2').setAttribute('stop-color', t.color);
  document.getElementById('lGlow').setAttribute('stroke', t.color); document.getElementById('rGlow').setAttribute('stroke', t.color);
  
  // Theme face overlays
  ['dog', 'terminator', 'monkey', 'starwars', 'transformer'].forEach(a => { const el = document.getElementById('theme-' + a); if (el) el.style.opacity = (tId === a) ? '1' : '0'; });
  const mg = document.getElementById('mouthGroup'), mr = document.getElementById('mouthRim');
  if (tId === 'transformer') { mg.style.opacity = '0'; mr.style.opacity = '0'; } else { mg.style.opacity = '1'; mr.style.opacity = '1'; }
  if (currentEmotion === 'neutral') setEmotion('neutral', true);
}

function openSettings() { 
  const k = getApiKey(); if (k) document.getElementById('apiKeyInput').value = k; 
  document.getElementById('settingsModal').classList.add('open'); 
  updateKeyBadge(); updateBleInfoBox(); updateMemoryPill(); updateUsageUI();
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }
document.getElementById('settingsModal').addEventListener('click', function(e) { if (e.target === this) closeSettings(); });

// TOKEN & COST TRACKING
function trackUsage(inTokens, outTokens) {
    let usage = JSON.parse(localStorage.getItem('petro_usage') || '{"in":0,"out":0,"req":0}');
    usage.in += inTokens; usage.out += outTokens; usage.req += 1;
    localStorage.setItem('petro_usage', JSON.stringify(usage));
    updateUsageUI();
}

function updateUsageUI() {
    const el = document.getElementById('usageBox'); if (!el) return;
    let usage = JSON.parse(localStorage.getItem('petro_usage') || '{"in":0,"out":0,"req":0}');
    // Est cost based on standard Gemini Flash pricing (~$0.075/1M in, ~$0.30/1M out)
    const cost = ((usage.in / 1000000) * 0.075) + ((usage.out / 1000000) * 0.30);
    el.innerHTML = `Requests: <b>${usage.req}</b><br>Tokens: <b>${usage.in.toLocaleString()}</b> In / <b>${usage.out.toLocaleString()}</b> Out<br>Est. Cost: <b>$${cost.toFixed(5)}</b>`;
}

function clearUsage() {
    localStorage.removeItem('petro_usage'); updateUsageUI(); toast('🗑 Usage reset');
}

// ════════════════════════════════════════════════════════
// BLUETOOTH
// ════════════════════════════════════════════════════════
async function toggleBLE() {
  if (bleConnected) { disconnectBLE(); return; }
  if (!navigator.bluetooth) { toast('❌ Web Bluetooth not supported.'); return; }
  setBLE(null); toast('🔍 Scanning…');
  try { bleDevice = await navigator.bluetooth.requestDevice({ filters: [{ name: BLE_NAME }], optionalServices: [BLE_SERVICE] }); } 
  catch(e1) { if (e1.name === 'AbortError') { setBLE(false); return; } try { bleDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [BLE_SERVICE] }); } catch(e2) { setBLE(false); toast('❌ No BLE devices found.'); return; } }
  bleDevice.addEventListener('gattserverdisconnected', onBleDisconnect);
  toast(`🔗 Connecting to ${bleDevice.name}…`);
  try { const server = await bleDevice.gatt.connect(); const service = await server.getPrimaryService(BLE_SERVICE); bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR); setBLE(true); toast(`✅ Connected!`); updateBleInfoBox(); resetInactivity(); } 
  catch(e) { setBLE(false); bleDevice = null; toast('❌ Connection failed.'); }
}
function disconnectBLE() { try { bleDevice?.gatt?.disconnect(); } catch {} bleDevice = null; bleCmdChar = null; setBLE(false); toast('Disconnected'); updateBleInfoBox(); }
function onBleDisconnect() { if (!bleConnected) return; setBLE(false); toast('⚠️ petRO disconnected.'); bleCmdChar = null; updateBleInfoBox(); }
function setBLE(s) { const b = document.getElementById('bleBtn'); if (s === null) { b.className='badge ble-spin'; b.textContent='⟳ BLE…'; } else if (s) { b.className='badge ble-on'; b.textContent='🟢 BLE'; } else { b.className='badge ble-off'; b.textContent='⚫ BLE'; } bleConnected = !!s; }
function updateBleInfoBox() { const el = document.getElementById('bleInfoBox'); if (!el) return; el.innerHTML = (bleConnected && bleDevice) ? `Status: <span style="color:var(--green)">Connected ✓</span>` : `Status: <span style="color:var(--red)">Not connected</span>`; }

async function bleSend(cmd) {
  if (!bleCmdChar) return;
  hardwareActive = true; 
  clearTimeout(hwTimeout); 
  hwTimeout = setTimeout(() => hardwareActive = false, 3000);

  if (!bleDevice?.gatt?.connected) { try { const server = await bleDevice.gatt.connect(); const service = await server.getPrimaryService(BLE_SERVICE); bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR); setBLE(true); } catch(e) { setBLE(false); return; } }
  try { await bleCmdChar.writeValueWithoutResponse(new TextEncoder().encode(cmd)); } catch(e) { setBLE(false); bleCmdChar = null; }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════
// DIRECT MOVEMENT & HARDWARE ACTIONS
// ════════════════════════════════════════════════════════
let isMoving = false;
async function startDirectMove(cmd) { if (!bleConnected) { toast('⚠️ Connect BLE first!'); return; } resetInactivity(); isMoving = true; await bleSend(cmd); }
async function stopDirectMove() { if (!isMoving || !bleConnected) return; isMoving = false; await bleSend('S'); }

async function doAction(action) {
  if (!bleConnected) { toast('⚠️ Connect BLE first!'); return; }
  resetInactivity();
  switch(action) { case 'nod': await bleSend('N'); await sleep(2000); break; case 'dance': await doDance(); break; case 'wander': await doWander(); break; }
}
async function doDance() { toast('💃 Dancing!'); setEmotion('excited'); for (const [cmd, ms] of DANCE_STEPS) { await bleSend(cmd); if (ms > 0) await sleep(ms); } toast('🎉 Done!'); }
async function doWander() { toast('🗺 Wandering!'); setEmotion('focused'); await bleSend('W'); await sleep(4000); toast('✅ Done'); }

// ════════════════════════════════════════════════════════
// MOTION SENSORS
// ════════════════════════════════════════════════════════
function enableMotionSensors() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(r => { if (r == 'granted') { motionEnabled = true; bindSensors(); toast('✅ Motion Synced'); document.getElementById('gyroBtn').style.display='none'; } else toast('❌ Permission denied'); }).catch(console.error);
  } else { motionEnabled = true; bindSensors(); toast('✅ Motion Synced'); document.getElementById('gyroBtn').style.display='none'; }
}
let lastAccel = 0;
function bindSensors() {
  window.addEventListener('devicemotion', (e) => { 
    if(isSleeping || !motionEnabled || isMoving || hardwareActive) return;
    let acc = e.accelerationIncludingGravity; if(!acc) return; 
    let total = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z); 
    if(Math.abs(total - lastAccel) > 25) { setEmotion('dizzy'); resetInactivity(); } 
    lastAccel = total; 
  });
  window.addEventListener('deviceorientation', (e) => { 
    if(isSleeping || !motionEnabled || isMoving || hardwareActive) return;
    if(Math.abs(e.beta) > 60 || Math.abs(e.gamma) > 60) { if(currentEmotion !== 'afraid') setEmotion('afraid'); resetInactivity(); } 
  });
}

// ════════════════════════════════════════════════════════
// GEMINI AGENT
// ════════════════════════════════════════════════════════
function buildSystemPrompt() {
  const uName = localStorage.getItem('petro_user_name') || ''; const theme = THEMES[localStorage.getItem('petro_theme') || 'default'];
  let p = theme.prompt; if (uName) p = `You are talking to your owner/friend named: ${uName}. ` + p;
  p += `
AVAILABLE FUNCTIONS:
  move_forward(sec), move_backward(sec), turn_left(sec), turn_right(sec), stop_robot()
  dance() -> triggers dynamic dance routines
  nod_head(times) -> nods head
  wander() -> wanders around
  capture_photo() -> take a picture
  search_youtube(query, is_entertainment) -> play video. Set is_entertainment to true if query is music/dance to trigger a slow groove.
  call_contact(num) -> call phone
  show_prop(prop_name) -> Displays visual prop on UI ('apple', 'book', 'dumbbell', 'laptop'). USE THIS if user mentions eating, studying, working out, or coding/working.
  perform_pattern(pattern) -> Executes special movement ('circle', 'rectangle', 'moonwalk', 'spin'). Use if asked to draw shape or dance specifically.

EMOTION HARDWARE TRIGGERING: Append [emotion:NAME] (e.g. [emotion:happy], [emotion:sad], [emotion:focused]) to physically trigger C++ macro routines!`;
  return p;
}

const TOOL_DECLARATIONS = [
  { name:'move_forward', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER'} }} },
  { name:'move_backward', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER'} }} },
  { name:'turn_left', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER'} }} },
  { name:'turn_right', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER'} }} },
  { name:'stop_robot', parameters:{type:'OBJECT',properties:{}} },
  { name:'dance', parameters:{type:'OBJECT',properties:{}} },
  { name:'nod_head', parameters:{type:'OBJECT',properties:{ times: {type: 'INTEGER'} }} },
  { name:'wander', parameters:{type:'OBJECT',properties:{}} },
  { name:'capture_photo', parameters:{type:'OBJECT',properties:{}} },
  { name:'search_youtube', parameters:{type:'OBJECT',properties:{query:{type:'STRING'}, is_entertainment:{type:'BOOLEAN', description: 'true if music/dance/entertainment'}},required:['query']} },
  { name:'call_contact', parameters:{type:'OBJECT',properties:{ phone_number: {type: 'STRING'} }, required:['phone_number']} },
  { name:'show_prop', parameters:{type:'OBJECT',properties:{ prop_name: {type: 'STRING', description: 'apple, book, dumbbell, or laptop'} }, required:['prop_name']} },
  { name:'perform_pattern', parameters:{type:'OBJECT',properties:{ pattern: {type: 'STRING', description: 'circle, rectangle, moonwalk, spin'} }, required:['pattern']} }
];

async function callGemini(userText, imageDataUrl = null) {
  const apiKey = getApiKey(); if (!apiKey) { toast('⚠️ Set API key in Settings'); openSettings(); throw new Error('No API key'); }
  const contents = chatHistory.map(m => { const parts = [{ text: m.text }]; if (m.imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: m.imageBase64.replace(/^data:image\/\w+;base64,/, '') } }); return { role: m.role, parts }; });
  const userParts = [{ text: userText }]; if (imageDataUrl) userParts.push({ inline_data: { mime_type: 'image/jpeg', data: imageDataUrl.replace(/^data:image\/\w+;base64,/, '') } }); contents.push({ role: 'user', parts: userParts });

  const body = { system_instruction: { parts: [{ text: buildSystemPrompt() }] }, contents, tools: [{ function_declarations: TOOL_DECLARATIONS }], generationConfig: { temperature: 0.7, maxOutputTokens: 512 } };
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  if (!resp.ok) { const err = await resp.json().catch(() => ({})); const msg = err?.error?.message || `HTTP ${resp.status}`; if (resp.status === 400 && msg.includes('API_KEY')) throw new Error('Invalid API key'); throw new Error(msg); }
  const data = await resp.json(); 
  
  if (data.usageMetadata) {
      trackUsage(data.usageMetadata.promptTokenCount || 0, data.usageMetadata.candidatesTokenCount || 0);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  let replyText = ''; const toolCalls = [];

  for (const part of parts) { if (part.text) replyText = part.text; if (part.functionCall) toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} }); }

  const emotionMatch = replyText.match(/\[emotion:(\w+)\]/i); const emotion = emotionMatch ? emotionMatch[1].toLowerCase() : detectEmotion(toolCalls, replyText);
  replyText = replyText.replace(/\[emotion:\w+\]/gi, '').trim();

  return { reply: replyText, emotion, toolCalls };
}

const EMOTION_MAP = { dance:'excited', nod_head:'happy', wander:'focused', move_forward:'focused', stop_robot:'neutral', capture_photo:'excited', search_youtube:'focused' };
function detectEmotion(toolCalls, reply) {
  for (const tc of toolCalls) { if (EMOTION_MAP[tc.name]) return EMOTION_MAP[tc.name]; }
  const l = reply.toLowerCase(); 
  if (/love|heart|hug|sweet|cute/.test(l)) return 'loving';
  if (/wow|omg|surprise|whoa|amazing/.test(l)) return 'surprised';
  if (/shy|blush|embarrass/.test(l)) return 'shy';
  if (/haha|lol|funny|joke|laugh/.test(l)) return 'happy'; 
  if (/danc|boogie/.test(l)) return 'excited'; 
  if (/sorry|oops|error|can't|cannot/.test(l)) return 'sad'; 
  if (/angry|mad/.test(l)) return 'angry'; 
  return 'neutral';
}

// ════════════════════════════════════════════════════════
// YOUTUBE, GROOVE & PROPS
// ════════════════════════════════════════════════════════
function startGroove() {
  if (grooveTimer || !bleConnected) return;
  let step = 0;
  const grooveMoves = ['V', '1', '2', 'U', '7', '8', '3', '4']; 
  grooveTimer = setInterval(() => {
     if (!isMoving && !isBusy && bleConnected) { bleSend(grooveMoves[step % grooveMoves.length]); step++; }
  }, 1800);
}

function stopGroove() { clearInterval(grooveTimer); grooveTimer = null; if (bleConnected) bleSend('E'); }

async function openYouTube(query, isEntertainment = false) {
  toast(`🔍 Searching YouTube for "${query}"...`);
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${YT_API_KEY}`);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const vid = data.items[0].id.videoId;
      
      document.getElementById('ytContainer').style.display = 'flex';
      document.getElementById('normalControls').style.display = 'none';
      document.getElementById('miniPetroArea').style.display = 'flex';
      
      if (isYtApiReady) {
          if (!ytPlayer) {
              ytPlayer = new YT.Player('ytPlayerDiv', {
                  height: '100%', width: '100%', videoId: vid,
                  playerVars: { 'autoplay': 1, 'controls': 1 },
                  events: { 'onStateChange': onPlayerStateChange }
              });
          } else {
              ytPlayer.loadVideoById(vid);
          }
      } else {
         document.getElementById('ytPlayerDiv').innerHTML = `<iframe src="https://www.youtube.com/embed/${vid}?autoplay=1" style="width:100%;height:100%;border:none;" allow="autoplay" allowfullscreen></iframe>`;
      }
      
      appendMsg('bot', `Now Playing. If video gets stuck, watch here: https://youtube.com/watch?v=${vid}`);
      
      isVideoPlaying = true;
      if (alwaysOnMic) { stopAllRecog(); micSuspendedForVideo = true; toast('🎤 Mic paused for media'); }
      if (isEntertainment || query.toLowerCase().includes('music') || query.toLowerCase().includes('dance')) { startGroove(); }

    } else { toast('❌ No video found.'); }
  } catch (error) { toast('❌ YouTube search failed.'); }
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.ENDED) {
        closeYouTube();
    }
}

function closeYouTube() { 
  document.getElementById('ytContainer').style.display = 'none'; 
  
  if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
      ytPlayer.stopVideo();
  } else {
      document.getElementById('ytPlayerDiv').innerHTML = ''; 
  }
  
  document.getElementById('normalControls').style.display = 'flex';
  document.getElementById('miniPetroArea').style.display = 'none';
  
  isVideoPlaying = false;
  stopGroove();
  
  if (micSuspendedForVideo) {
      alwaysOnMic = true; startBgListen(); updateMicBadge('wake'); 
      micSuspendedForVideo = false; toast('🎤 Mic resumed');
  }
}

function showProp(propName) {
  document.querySelectorAll('.prop-item').forEach(el => el.style.opacity = '0');
  const el = document.getElementById('prop-' + propName);
  if (el) { el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0'; }, 5000); }
}

async function doPattern(pattern) {
  toast(`Executing ${pattern}!`); if (!bleConnected) return;
  if (pattern === 'circle') { await bleSend('L'); await sleep(3500); await bleSend('S'); } 
  else if (pattern === 'rectangle') { for (let i=0; i<4; i++) { await bleSend('F'); await sleep(1000); await bleSend('R'); await sleep(600); } await bleSend('S'); } 
  else if (pattern === 'moonwalk') { for (let i=0; i<4; i++) { await bleSend('B'); await sleep(500); await bleSend('S'); await sleep(200); } } 
  else if (pattern === 'spin') { await bleSend('L'); await sleep(1500); await bleSend('S'); }
}

// ════════════════════════════════════════════════════════
// TOOL EXECUTION
// ════════════════════════════════════════════════════════
async function executeTools(toolCalls) {
  for (const tc of toolCalls) {
    const args = tc.args || {};
    switch(tc.name) {
      case 'move_forward':  await startDirectMove('F'); await sleep((args.duration_seconds || 1) * 1000); await stopDirectMove(); await sleep(100); break;
      case 'move_backward': await startDirectMove('B'); await sleep((args.duration_seconds || 1) * 1000); await stopDirectMove(); await sleep(100); break;
      case 'turn_left':     await startDirectMove('L'); await sleep((args.duration_seconds || 0.5) * 1000); await stopDirectMove(); await sleep(100); break;
      case 'turn_right':    await startDirectMove('R'); await sleep((args.duration_seconds || 0.5) * 1000); await stopDirectMove(); await sleep(100); break;
      case 'stop_robot':    await stopDirectMove(); break;
      case 'dance':         await doDance(); break;
      case 'nod_head':      for (let i = 0; i < (args.times || 1); i++) { await doAction('nod'); } break;
      case 'wander':        await doWander(); break;
      case 'capture_photo': autoCapture(); break;
      case 'search_youtube':if (args.query) await openYouTube(args.query, args.is_entertainment); break;
      case 'call_contact':  if (args.phone_number) { toast(`📞 Calling...`); window.location.href = `tel:${args.phone_number}`; } break;
      case 'show_prop':     if (args.prop_name) showProp(args.prop_name); break;
      case 'perform_pattern':if(args.pattern) await doPattern(args.pattern); break;
    }
  }
}

// ════════════════════════════════════════════════════════
// CHAT FLOW
// ════════════════════════════════════════════════════════
async function sendChat() {
  const inp = document.getElementById('userInput'), text = inp.value.trim();
  if (!text || isBusy) return; inp.value = ''; resetInactivity();
  let attachedImage = currentUploadedImage || null; currentUploadedImage = null; updateUploadPreview();
  const visionKw = ['what am i holding','look at me','what is this','see this'];
  if (!attachedImage && visionKw.some(kw => text.toLowerCase().includes(kw))) { attachedImage = captureSnapshot(); if (attachedImage) { appendImageMsg('user', attachedImage); toast('📸 Auto-captured!'); } } else if (attachedImage) { appendImageMsg('user', attachedImage); }
  appendMsg('user', text); await doChat(text, attachedImage);
}
function sendSug(t) { document.getElementById('userInput').value = t; sendChat(); }
async function doChat(userText, imageDataUrl = null) {
  isBusy = true; document.getElementById('sendBtn').disabled = true; const typEl = showTyping();
  try {
    const { reply, emotion, toolCalls } = await callGemini(userText, imageDataUrl); removeTyping(typEl);
    appendMsg('bot', reply, toolCalls.map(t => t.name)); setEmotion(emotion); speak(reply);
    addToHistory('user', userText, imageDataUrl); addToHistory('model', reply); await executeTools(toolCalls);
  } catch(e) { removeTyping(typEl); appendMsg('bot', `❌ ${e.message}`, []); setEmotion('sad'); speak('Oops! Error.'); } finally { isBusy = false; document.getElementById('sendBtn').disabled = false; }
}
function addToHistory(role, text, imageBase64 = null) { chatHistory.push({ role, text, imageBase64 }); if (chatHistory.length > MAX_HISTORY) chatHistory.splice(0, chatHistory.length - MAX_HISTORY); try { sessionStorage.setItem('petro_history', JSON.stringify(chatHistory.map(m => ({...m, imageBase64: null})))); } catch {} updateMemoryPill(); }
function loadHistory() { try { const saved = sessionStorage.getItem('petro_history'); if (saved) chatHistory = JSON.parse(saved); } catch {} }
function clearChat() { chatHistory = []; try { sessionStorage.removeItem('petro_history'); } catch {} document.getElementById('messages').innerHTML = `<div class="msg bot"><div class="msg-label">petRO 🤖</div><div class="msg-bubble">Fresh start! ✨</div></div>`; toast('Chat cleared'); updateMemoryPill(); }
function updateMemoryPill() { document.getElementById('memoryPill').textContent = `Memory: ${chatHistory.length} / ${MAX_HISTORY} msgs`; }

// ════════════════════════════════════════════════════════
// CAMERA
// ════════════════════════════════════════════════════════
async function initCamera() { try { videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); document.getElementById('webcamView').srcObject = videoStream; } catch(e) { console.warn('Camera unavailable:', e); } }
function captureSnapshot() { const video = document.getElementById('webcamView'), canvas = document.getElementById('captureCanvas'); if (!video || !canvas || !videoStream) return null; const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480; ctx.drawImage(video, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', 0.85); }
function triggerFlash() { const f = document.createElement('div'); Object.assign(f.style, { position:'fixed', inset:'0', background:'#fff', zIndex:'9999', opacity:'1', transition:'opacity 0.4s ease' }); document.body.appendChild(f); setTimeout(() => { f.style.opacity = '0'; setTimeout(() => f.remove(), 400); }, 50); }
function manualCapture() { const dataUrl = captureSnapshot(); if (dataUrl) { appendImageMsg('user', dataUrl); toast('📸 Captured!'); } }
function autoCapture() { triggerFlash(); setTimeout(() => { const dataUrl = captureSnapshot(); if (dataUrl) { appendImageMsg('bot', dataUrl); doChat('Describe in detail what you see in this photo!', dataUrl); toast('📸 Snap!'); } }, 120); }
function handleFileUpload(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => { currentUploadedImage = ev.target.result; updateUploadPreview(); }; reader.readAsDataURL(file); }
function clearUploadedImage() { currentUploadedImage = null; document.getElementById('fileInput').value = ''; updateUploadPreview(); }
function updateUploadPreview() { const bar = document.getElementById('uploadPreviewBar'), img = document.getElementById('previewImg'); if (currentUploadedImage) { img.src = currentUploadedImage; bar.style.display = 'flex'; } else { bar.style.display = 'none'; img.src = ''; } }
function appendImageMsg(role, dataUrl) { const c = document.getElementById('messages'), el = document.createElement('div'); el.className = `msg ${role}`; const bub = document.createElement('div'); bub.className = 'msg-bubble'; bub.style.padding = '4px'; const img = document.createElement('img'); img.src = dataUrl; img.style.cssText = 'max-width:100%;border-radius:10px;display:block;'; bub.appendChild(img); el.appendChild(bub); c.appendChild(el); c.scrollTop = c.scrollHeight; }

// ════════════════════════════════════════════════════════
// TTS
// ════════════════════════════════════════════════════════
const synth = window.speechSynthesis;
function speak(text) {
  if (!synth || isVideoPlaying) return; 
  synth.cancel(); const clean = text.replace(/\p{Emoji}/gu, '').replace(/\[emotion:\w+\]/gi, '').trim(); if (!clean) return;
  const utt = new SpeechSynthesisUtterance(clean);
  const theme = localStorage.getItem('petro_theme') || 'default'; let pitch = 1.0, rate = 1.05;
  if (theme === 'terminator') { pitch = 0.4; rate = 0.9; } else if (theme === 'transformer') { pitch = 0.1; rate = 0.85; } else if (theme === 'monkey') { pitch = 1.5; rate = 1.25; } else if (theme === 'dog') { pitch = 1.3; rate = 1.15; } else if (theme === 'starwars') { pitch = 1.8; rate = 1.4; }
  utt.pitch = pitch; utt.rate = rate; utt.volume = 1;
  
  // Detect Hindi logic
  const isHindi = /[\u0900-\u097F]/.test(clean);
  const voices = synth.getVoices();
  let pref;
  if (isHindi) {
      pref = voices.find(v => v.lang.startsWith('hi')) || voices.find(v => v.lang.includes('IN'));
  } else {
      pref = voices.find(v => /female|zira|samantha|karen|moira|fiona/i.test(v.name)) || voices.find(v => v.lang.startsWith('en')) || voices[0];
  }
  if (pref) utt.voice = pref;
  
  utt.onstart = () => { ttsActive = true; updateTTSBtn(); animateMouth(true); }; 
  utt.onend = () => { 
      ttsActive = false; updateTTSBtn(); animateMouth(false); 
      setTimeout(() => { if (!isBusy && !isVideoPlaying) startFollowUp(); }, 400);
  }; 
  utt.onerror = () => { 
      ttsActive = false; updateTTSBtn(); animateMouth(false); 
      setTimeout(() => { if (!isBusy && !isVideoPlaying) startFollowUp(); }, 400);
  };
  synth.speak(utt);
}
function stopTTS() { synth?.cancel(); ttsActive = false; updateTTSBtn(); animateMouth(false); }
function updateTTSBtn() { document.getElementById('ttsBtn').className = ttsActive ? 'icon-btn speaking' : 'icon-btn'; }
function animateMouth(talking) { if (mouthTalkAnim) { cancelAnimationFrame(mouthTalkAnim); mouthTalkAnim = null; } if (!talking) { applyMouthForEmotion(currentEmotion); return; } let t = 0; const em = emotions[currentEmotion] || emotions.neutral; (function frame() { t += 0.18; setMouthPath(em.mouthType, (em.mouthOpen || 0) + Math.abs(Math.sin(t)) * 12); mouthTalkAnim = requestAnimationFrame(frame); })(); }

// ════════════════════════════════════════════════════════
// EXPRESSIVE FACE ENGINE
// ════════════════════════════════════════════════════════
const eyeEls = {}; let eyeOff = {lx:0,ly:0,rx:0,ry:0}, eyeTgt = {lx:0,ly:0,rx:0,ry:0};
function initEyes() { ['lIris','lPupil','lLidTop','lLidBot','lHL1','lHL2','lRim','lBrow', 'rIris','rPupil','rLidTop','rLidBot','rHL1','rHL2','rRim','rBrow'].forEach(k => eyeEls[k] = document.getElementById(k)); runEyeLoop(); scheduleBlink(); scheduleEyeMove(); }
function runEyeLoop() { (function loop() { const s = 0.12; eyeOff.lx += (eyeTgt.lx - eyeOff.lx)*s; eyeOff.ly += (eyeTgt.ly - eyeOff.ly)*s; eyeOff.rx += (eyeTgt.rx - eyeOff.rx)*s; eyeOff.ry += (eyeTgt.ry - eyeOff.ry)*s; setEyePos('l', 65+eyeOff.lx, 88+eyeOff.ly); setEyePos('r',235+eyeOff.rx, 88+eyeOff.ry); requestAnimationFrame(loop); })(); }
function scheduleEyeMove() { if (!isSleeping) { if (Math.random() > 0.4) { const angle = Math.random() * Math.PI * 2, radius = Math.random() * 12; eyeTgt.lx = Math.cos(angle) * radius; eyeTgt.ly = Math.sin(angle) * radius; eyeTgt.rx = eyeTgt.lx; eyeTgt.ry = eyeTgt.ly; } else { eyeTgt.lx = 0; eyeTgt.ly = 0; eyeTgt.rx = 0; eyeTgt.ry = 0; } } else { eyeTgt.lx = 0; eyeTgt.ly = 0; eyeTgt.rx = 0; eyeTgt.ry = 0; } setTimeout(scheduleEyeMove, 1000 + Math.random() * 2500); }
function setEyePos(s, x, y) { eyeEls[`${s}Iris`].setAttribute('cx', x); eyeEls[`${s}Iris`].setAttribute('cy', y); eyeEls[`${s}Pupil`].setAttribute('cx', x); eyeEls[`${s}Pupil`].setAttribute('cy', y); eyeEls[`${s}HL1`].setAttribute('cx', x-11); eyeEls[`${s}HL1`].setAttribute('cy', y-13); eyeEls[`${s}HL2`].setAttribute('cx', x+11); eyeEls[`${s}HL2`].setAttribute('cy', y-9); }
function scheduleBlink() { blinkTimer = setTimeout(() => { doBlink(); scheduleBlink(); }, isSleeping ? 9000 : 2000 + Math.random()*4000); }

const emotions = {
  neutral:   { irisR:42, pupilR:22, color:'var(--theme-color)', lidTopY:-65, lidBotY:200, browW:0, browSlant:0,  mouthType:'smile',  mouthOpen:0,  tears:false },
  happy:     { irisR:48, pupilR:26, color:'#22d3a0', lidTopY:-65, lidBotY:142, browW:0, browSlant:0,  mouthType:'smile',  mouthOpen:12, tears:false },
  curious:   { irisR:44, pupilR:24, color:'#3b9eff', lidTopY:-65, lidBotY:200, browW:5, browSlant:5,  mouthType:'small',  mouthOpen:8,  tears:false },
  excited:   { irisR:52, pupilR:30, color:'#ffd23f', lidTopY:-65, lidBotY:200, browW:0, browSlant:-6, mouthType:'laugh',  mouthOpen:20, tears:true  },
  sad:       { irisR:30, pupilR:15, color:'#6b8db5', lidTopY:-18, lidBotY:200, browW:8, browSlant:8,  mouthType:'frown',  mouthOpen:0,  tears:true  },
  angry:     { irisR:36, pupilR:17, color:'#ff5f6d', lidTopY:-24, lidBotY:200, browW:9, browSlant:-9, mouthType:'flat',   mouthOpen:0,  tears:false },
  focused:   { irisR:38, pupilR:18, color:'#a855f7', lidTopY:-65, lidBotY:200, browW:0, browSlant:0,  mouthType:'small',  mouthOpen:0,  tears:false },
  dizzy:     { irisR:20, pupilR:8,  color:'#ff9800', lidTopY:-65, lidBotY:200, browW:4, browSlant:5,  mouthType:'wiggle', mouthOpen:0,  tears:false },
  afraid:    { irisR:55, pupilR:10, color:'#ddeeff', lidTopY:-65, lidBotY:200, browW:5, browSlant:8,  mouthType:'small',  mouthOpen:10, tears:false },
  surprised: { irisR:40, pupilR:20, color:'#ff9800', lidTopY:-80, lidBotY:200, browW:6, browSlant:-10,mouthType:'smile',  mouthOpen:20, tears:false },
  shy:       { irisR:45, pupilR:24, color:'#ff66b2', lidTopY:-20, lidBotY:180, browW:4, browSlant:5,  mouthType:'small',  mouthOpen:0,  tears:false },
  loving:    { irisR:55, pupilR:28, color:'#ff3366', lidTopY:-65, lidBotY:200, browW:0, browSlant:0,  mouthType:'smile',  mouthOpen:15, tears:false },
  sleeping:  { irisR:7,  pupilR:4,  color:'#3d5470', lidTopY:45,  lidBotY:65,  browW:0, browSlant:0,  mouthType:'sleep',  mouthOpen:0,  tears:false },
};

function doBlink() { const em = emotions[currentEmotion] || emotions.neutral; lidAnim(eyeEls.lLidTop, em.lidTopY, 30, 200); lidAnim(eyeEls.rLidTop, em.lidTopY, 30, 200); }
function lidAnim(el, from, to, back) { const steps = [{y:to,ms:70},{y:back,ms:50},{y:from,ms:65}]; let i = 0; (function nx() { if (i >= steps.length) return; const s = steps[i++]; el.setAttribute('y', s.y); setTimeout(nx, s.ms); })(); }

function setEmotion(name, force = false) {
  if (isSleeping && !force) return;
  const em = emotions[name] || emotions.neutral; currentEmotion = name;
  clearTimeout(emotionResetTimer);
  if (name !== 'neutral' && name !== 'sleeping') emotionResetTimer = setTimeout(() => setEmotion('neutral'), 5000);

  if (bleConnected && !force && name !== 'sleeping') {
      const hwMap = { happy:'H', sad:'O', angry:'G', focused:'N', excited:'D', afraid:'W', dizzy:'X', curious:'X', surprised:'H', shy:'N', loving:'H' };
      if (hwMap[name]) bleSend(hwMap[name]);
  }

  for (const s of ['l','r']) { eyeEls[`${s}Iris`].setAttribute('rx', em.irisR); eyeEls[`${s}Iris`].setAttribute('ry', em.irisR); eyeEls[`${s}Pupil`].setAttribute('rx', em.pupilR); eyeEls[`${s}Pupil`].setAttribute('ry', em.pupilR); eyeEls[`${s}Iris`].style.fill = (name==='neutral') ? 'url(#ig1)' : em.color; eyeEls[`${s}LidTop`].setAttribute('y', em.lidTopY); eyeEls[`${s}LidBot`].setAttribute('y', em.lidBotY); eyeEls[`${s}Rim`].setAttribute('stroke', em.color); }
  eyeEls.lBrow.setAttribute('stroke-width', em.browW); eyeEls.rBrow.setAttribute('stroke-width', em.browW); eyeEls.lBrow.setAttribute('stroke', em.color); eyeEls.rBrow.setAttribute('stroke', em.color);
  if (em.browSlant !== 0) { eyeEls.lBrow.setAttribute('y1', 35 - em.browSlant); eyeEls.lBrow.setAttribute('y2', 35 + em.browSlant); eyeEls.rBrow.setAttribute('y1', 35 + em.browSlant); eyeEls.rBrow.setAttribute('y2', 35 - em.browSlant); } else { eyeEls.lBrow.setAttribute('y1', 35); eyeEls.lBrow.setAttribute('y2', 35); eyeEls.rBrow.setAttribute('y1', 35); eyeEls.rBrow.setAttribute('y2', 35); }
  document.getElementById('tearGroup').style.opacity = em.tears ? '1' : '0';
  if (!ttsActive) applyMouthForEmotion(name);
}

function applyMouthForEmotion(name) { const em = emotions[name] || emotions.neutral; setMouthPath(em.mouthType, em.mouthOpen); document.getElementById('mouthRim').setAttribute('stroke', em.color); }
function setMouthPath(type, open = 0) { const mp = document.getElementById('mouthPath'); let d = ''; switch(type) { case 'smile': d = `M 105 165 Q 150 ${178+open} 195 165`; break; case 'laugh': d = `M 105 162 Q 150 ${185+open} 195 162`; break; case 'frown': d = `M 105 174 Q 150 ${162-open} 195 174`; break; case 'flat': d = `M 110 169 L 190 169`; break; case 'small': d = `M 125 168 Q 150 ${174+open} 175 168`; break; case 'sleep': d = `M 125 168 Q 150 168 175 168`; break; case 'wiggle': d = `M 110 169 Q 130 159 150 169 T 190 169`; break; default: d = `M 105 169 Q 150 ${178+open} 195 169`; } mp.setAttribute('d', d); if (type === 'laugh') { mp.setAttribute('fill','rgba(0,0,0,0.5)'); mp.setAttribute('stroke-width','2.5'); } else { mp.setAttribute('fill','none'); mp.setAttribute('stroke-width','3.5'); } }

// ════════════════════════════════════════════════════════
// SLEEP / WAKE / IDLE / MIC
// ════════════════════════════════════════════════════════
function goToSleep() { if(isSleeping)return; isSleeping=true; setEmotion('sleeping',true); stopTTS(); startZZZ(); }
function wakeUp() { if(!isSleeping)return; isSleeping=false; stopZZZ(); setEmotion('neutral',true); resetInactivity(); }
function startZZZ() { const g = document.getElementById('sleepZZZ'), z1 = document.getElementById('z1'), z2 = document.getElementById('z2'), z3 = document.getElementById('z3'); g.style.opacity = '1'; let t = 0; (function f() { t+=0.03; const b=Math.sin(t)*0.3+0.7; z1.setAttribute('opacity',b); z2.setAttribute('opacity',b*0.7); z3.setAttribute('opacity',b*0.45); z1.setAttribute('y',40-Math.sin(t*0.7)*7); z2.setAttribute('y',24-Math.sin(t*0.7+.5)*7); z3.setAttribute('y',6-Math.sin(t*0.7+1)*7); zzzAnim=requestAnimationFrame(f); })(); }
function stopZZZ() { if(zzzAnim)cancelAnimationFrame(zzzAnim); document.getElementById('sleepZZZ').style.opacity = '0'; }

function resetInactivity() { 
  if(isSleeping) wakeUp(); 
  clearTimeout(inactTimer); clearTimeout(idleMoveTimer);
  inactTimer = setTimeout(goToSleep, SLEEP_MS);
  scheduleIdleMove(); 
}

function scheduleIdleMove() {
  idleMoveTimer = setTimeout(() => {
    if (!isSleeping && !isBusy && bleConnected && !isVideoPlaying) {
       // Occasional physical wander vs smaller moves
       if (Math.random() > 0.85) {
           doWander(); 
       } else {
           const idleMoves = ['7', '8', 'E', 'C', 'A', 'V', 'U']; 
           bleSend(idleMoves[Math.floor(Math.random() * idleMoves.length)]);
       }
       
       if (Math.random() > 0.5) {
           const idleEmotions = ['happy', 'focused', 'curious', 'neutral', 'shy', 'loving'];
           setEmotion(idleEmotions[Math.floor(Math.random() * idleEmotions.length)]);
       }
    }
    scheduleIdleMove();
  }, 10000 + Math.random() * 15000); 
}

['click','keydown','touchstart'].forEach(e => document.addEventListener(e, resetInactivity, {passive:true}));

function appendMsg(role, text, actions = []) { const c = document.getElementById('messages'), el = document.createElement('div'); el.className = `msg ${role}`; const lbl = document.createElement('div'); lbl.className = 'msg-label'; lbl.textContent = role === 'user' ? 'You' : 'petRO 🤖'; const bub = document.createElement('div'); bub.className = 'msg-bubble'; bub.textContent = text; el.append(lbl, bub); if (actions?.length) { const chip = document.createElement('div'); chip.className = 'actions-chip'; chip.textContent = '⚡ ' + actions.join(' · '); el.append(chip); } c.append(el); c.scrollTop = c.scrollHeight; }
function showTyping() { const c=document.getElementById('messages'),el=document.createElement('div'); el.className='msg bot'; el.innerHTML=`<div class="msg-label">petRO 🤖</div><div class="typing-wrap"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`; c.append(el); c.scrollTop=c.scrollHeight; return el; }
function removeTyping(el) { el?.remove(); }
function toast(msg) { const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'), 3400); }

// ── EARS VISUAL OVERLAY FOR MIC ──
function toggleThemeEars(show) {
  const tId = document.getElementById('themeSelect').value || 'default';
  const group = document.getElementById('earsGroup');
  const statusTxt = document.getElementById('listeningStatus');
  
  if (!show) { 
      group.style.opacity = '0'; 
      statusTxt.style.opacity = '0';
      return; 
  }
  
  document.querySelectorAll('.ear-theme').forEach(el => el.style.display = 'none');
  
  if (tId === 'dog') document.querySelector('.ear-dog').style.display = 'block';
  else if (tId === 'monkey') document.querySelector('.ear-monkey').style.display = 'block';
  else if (tId === 'terminator' || tId === 'transformer') document.querySelector('.ear-terminator').style.display = 'block';
  else document.querySelector('.ear-default').style.display = 'block';

  group.style.opacity = '1';
  statusTxt.style.opacity = '1';
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function toggleAlwaysOnMic() { if(!SR){toast('⚠️ Speech API not supported');return;} alwaysOnMic=!alwaysOnMic; if(alwaysOnMic){startBgListen(); updateMicBadge('wake');} else{stopAllRecog(); updateMicBadge('off');} }
function updateMicBadge(state) { const b=document.getElementById('micBadge'); if(state==='off'){b.className='badge mic-off'; b.textContent='🎤 OFF';} if(state==='wake'){b.className='badge mic-wake'; b.textContent='👂 WAKE';} if(state==='cmd'){b.className='badge mic-on'; b.textContent='🔴 REC';} }
function stopAllRecog() { try{bgRecog?.abort();}catch{} try{cmdRecog?.abort();}catch{} bgRecog=null; cmdRecog=null; micState='off'; toggleThemeEars(false); }

function startBgListen() { 
  if(!alwaysOnMic || micState==='cmd' || isVideoPlaying) return; 
  try{bgRecog?.abort();}catch{} bgRecog = new SR(); bgRecog.continuous=true; bgRecog.interimResults=true; bgRecog.lang='en-US'; micState='wake'; bgRecog.onresult = e => { if(micState!=='wake')return; for(let i=e.resultIndex; i<e.results.length; i++){ const t=e.results[i][0].transcript.toLowerCase(); if(WAKE_WORDS.some(w=>t.includes(w))) wakeWordDetected(); } }; bgRecog.onerror = e => { if(e.error!=='aborted') restartBg(); }; bgRecog.onend = () => { if(alwaysOnMic && micState==='wake') setTimeout(restartBg,300); }; try{bgRecog.start();}catch{} 
}

function restartBg() { if(alwaysOnMic && micState==='wake' && !isVideoPlaying) startBgListen(); }
function wakeWordDetected() { if(micState==='cmd')return; try{bgRecog?.abort();}catch{} resetInactivity(); showWakeOverlay(); listenForCommand(); }
function listenForCommand() { 
    micState='cmd'; updateMicBadge('cmd'); 
    cmdRecog = new SR(); cmdRecog.continuous=false; cmdRecog.interimResults=true; 
    const sub = document.getElementById('listeningStatus'); sub.textContent = 'Listening...'; 
    cmdRecog.onresult = e => { 
        const last = e.results[e.results.length-1]; const t = last[0].transcript; 
        if(last.isFinal){ 
            sub.textContent=`"${t}"`; hideWakeOverlay(); micState='wake'; 
            document.getElementById('userInput').value=t; appendMsg('user',t); doChat(t); 
            setTimeout(startBgListen,800); 
        } else { sub.textContent=t+'…'; } 
    }; 
    cmdRecog.onerror = () => { hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,400); }; 
    cmdRecog.onend = () => { if(micState==='cmd'){hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,400);} }; 
    try{cmdRecog.start();}catch{hideWakeOverlay(); micState='wake'; startBgListen();} 
}

// ── FOLLOW UP WINDOW ──
function startFollowUp() {
  if (!alwaysOnMic || isVideoPlaying) return;
  const dur = parseInt(document.getElementById('followUpSelect').value || '0', 10);
  if (dur === 0) return;

  followUpActive = true;
  showWakeOverlay();
  const sub = document.getElementById('listeningStatus');
  sub.textContent = 'Awaiting follow-up...';
  
  micState = 'cmd'; 
  updateMicBadge('cmd'); 
  
  try { cmdRecog?.abort(); } catch {}
  cmdRecog = new SR(); 
  cmdRecog.continuous = false; 
  cmdRecog.interimResults = true; 
  
  cmdRecog.onresult = e => { 
      const last = e.results[e.results.length-1]; const t = last[0].transcript; 
      if(last.isFinal){ 
          clearTimeout(followUpTimeout); followUpActive = false;
          sub.textContent=`"${t}"`; hideWakeOverlay(); micState='wake'; 
          document.getElementById('userInput').value=t; appendMsg('user',t); doChat(t); 
      } else { sub.textContent=t+'…'; } 
  }; 
  
  cmdRecog.onerror = (e) => { 
      if(followUpActive && e.error !== 'aborted') { try{cmdRecog.start();}catch{} } 
  }; 
  cmdRecog.onend = () => { 
      if(followUpActive) { try{cmdRecog.start();}catch{} } 
  }; 
  
  try { cmdRecog.start(); } catch { followUpActive = false; hideWakeOverlay(); micState='wake'; startBgListen(); }

  clearTimeout(followUpTimeout);
  followUpTimeout = setTimeout(() => {
      followUpActive = false;
      try { cmdRecog.abort(); } catch {}
      hideWakeOverlay(); 
      micState = 'wake'; 
      startBgListen();
  }, dur);
}

function cancelWake() { try{cmdRecog?.abort();}catch{} hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,300); }
function showWakeOverlay() { toggleThemeEars(true); updateMicBadge('cmd'); }
function hideWakeOverlay() { toggleThemeEars(false); updateMicBadge('wake'); }


// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  initEyes(); resetInactivity(); initCamera(); loadHistory(); loadPersonalization(); updateKeyBadge(); updateMemoryPill(); applyMouthForEmotion('neutral');
  if (synth) { synth.getVoices(); synth.addEventListener('voiceschanged', () => synth.getVoices()); }
});

```
