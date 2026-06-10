'use strict';

// ════════════════════════════════════════════════════════
// CONFIG & THEMES
// ════════════════════════════════════════════════════════
const WAKE_WORDS  = ['ok petro','okay petro','hey petro'];
const SLEEP_MS    = SLEEP_IDLE_MS; 
const MAX_HISTORY = 50;
const GEMINI_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const YT_API_KEY = 'AIzaSyC6Z2NDf7sy6oz35p5ZZfB8yYNVz5sJZZU';

const BLE_SERVICE  = '00001234-0000-1000-8000-00805f9b34fb';
const BLE_CMD_CHAR = '00005678-0000-1000-8000-00805f9b34fb';
const BLE_NAME     = 'petRO';

const BLE_RECONNECT_MAX    = 5;      // max auto-reconnect attempts
const BLE_RECONNECT_DELAY  = 2000;   // ms between retries (doubles each time)
const IDLE_EXPR_MS         = 12000;  // ms of inactivity before idle expression
const IDLE_MOVE_MIN        = 10000;  // idle move min interval
const IDLE_MOVE_MAX        = 20000;  // idle move max interval
const SLEEP_IDLE_MS        = 2 * 60 * 1000; // 2 min idle → sleep (was 5 min)

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
let bleReconnectAttempts = 0, bleReconnecting = false, bleReconnectTimer = null;
let currentEmotion = 'neutral', emotionResetTimer = null; 
let isSleeping = false, micState = 'off', alwaysOnMic = false;
let bgRecog = null, cmdRecog = null;
let inactTimer = null, idleMoveTimer = null, idleExprTimer = null, zzzAnim = null, blinkTimer = null;
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
  // If reconnecting, cancel and allow fresh scan
  if (bleReconnecting || bleReconnectAttempts > 0) {
    bleReconnecting = false;
    bleReconnectAttempts = BLE_RECONNECT_MAX; // stop further auto-retries
    clearTimeout(bleReconnectTimer);
    bleDevice = null; bleCmdChar = null; setBLE(false);
  }
  if (bleConnected) { disconnectBLE(); return; }
  if (!navigator.bluetooth) { toast('❌ Web Bluetooth not supported.'); return; }
  setBLE(null); toast('🔍 Scanning…');
  try { bleDevice = await navigator.bluetooth.requestDevice({ filters: [{ name: BLE_NAME }], optionalServices: [BLE_SERVICE] }); } 
  catch(e1) { if (e1.name === 'AbortError') { setBLE(false); return; } try { bleDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [BLE_SERVICE] }); } catch(e2) { setBLE(false); toast('❌ No BLE devices found.'); return; } }
  bleDevice.addEventListener('gattserverdisconnected', onBleDisconnect);
  toast(`🔗 Connecting to ${bleDevice.name}…`);
  try { const server = await bleDevice.gatt.connect(); const service = await server.getPrimaryService(BLE_SERVICE); bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR); setBLE(true); bleReconnectAttempts = 0; toast(`✅ Connected!`); updateBleInfoBox(); resetInactivity(); } 
  catch(e) { setBLE(false); bleDevice = null; toast('❌ Connection failed.'); }
}
function disconnectBLE() { 
  bleReconnectAttempts = BLE_RECONNECT_MAX; // prevent auto-reconnect on manual disconnect
  clearTimeout(bleReconnectTimer);
  try { bleDevice?.gatt?.disconnect(); } catch {} 
  bleDevice = null; bleCmdChar = null; setBLE(false); 
  toast('Disconnected'); updateBleInfoBox(); 
}

function onBleDisconnect() { 
  if (!bleConnected) return; 
  setBLE(false); bleCmdChar = null; 
  toast('⚠️ petRO disconnected.'); 
  updateBleInfoBox(); 
  scheduleReconnect(); 
}

function scheduleReconnect() {
  if (bleReconnecting || bleReconnectAttempts >= BLE_RECONNECT_MAX || !bleDevice) return;
  bleReconnecting = true;
  const delay = BLE_RECONNECT_DELAY * Math.pow(1.5, bleReconnectAttempts);
  bleReconnectAttempts++;
  toast(`🔄 Reconnecting (${bleReconnectAttempts}/${BLE_RECONNECT_MAX})… tap BLE to cancel`);
  bleReconnectTimer = setTimeout(async () => {
    bleReconnecting = false;
    if (bleConnected || !bleDevice) return;
    try {
      setBLE(null);
      const server = await bleDevice.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE);
      bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR);
      setBLE(true); bleReconnectAttempts = 0;
      toast('✅ Reconnected!'); updateBleInfoBox();
    } catch(e) {
      setBLE(false);
      if (bleReconnectAttempts < BLE_RECONNECT_MAX) {
        scheduleReconnect();
      } else {
        toast('❌ Could not reconnect. Tap BLE to retry.');
        bleDevice = null; bleCmdChar = null;
      }
    }
  }, delay);
}

function setBLE(s) { const b = document.getElementById('bleBtn'); if (s === null) { b.className='badge ble-spin'; b.textContent='⟳ BLE…'; } else if (s) { b.className='badge ble-on'; b.textContent='🟢 BLE'; } else { b.className='badge ble-off'; b.textContent='⚫ BLE'; } bleConnected = !!s; }
function updateBleInfoBox() { const el = document.getElementById('bleInfoBox'); if (!el) return; el.innerHTML = (bleConnected && bleDevice) ? `Status: <span style="color:var(--green)">Connected ✓</span>` : `Status: <span style="color:var(--red)">Not connected</span>`; }

async function bleSend(cmd) {
  if (!bleDevice) return;
  hardwareActive = true; 
  clearTimeout(hwTimeout); 
  hwTimeout = setTimeout(() => hardwareActive = false, 3000);

  // Try to reconnect if GATT is not connected
  if (!bleDevice?.gatt?.connected) { 
    try { 
      setBLE(null);
      const server = await bleDevice.gatt.connect(); 
      const service = await server.getPrimaryService(BLE_SERVICE); 
      bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR); 
      setBLE(true); bleReconnectAttempts = 0;
    } catch(e) { 
      setBLE(false); 
      scheduleReconnect();
      return; 
    } 
  }
  try { 
    await bleCmdChar.writeValueWithoutResponse(new TextEncoder().encode(cmd)); 
  } catch(e) { 
    setBLE(false); bleCmdChar = null; 
    scheduleReconnect();
  }
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
function wakeUp() { if(!isSleeping)return; isSleeping=false; stopZZZ(); setEmotion('neutral',true); resetInactivity(); toast('👋 petRO is awake!'); }
function startZZZ() { const g = document.getElementById('sleepZZZ'), z1 = document.getElementById('z1'), z2 = document.getElementById('z2'), z3 = document.getElementById('z3'); g.style.opacity = '1'; let t = 0; (function f() { t+=0.03; const b=Math.sin(t)*0.3+0.7; z1.setAttribute('opacity',b); z2.setAttribute('opacity',b*0.7); z3.setAttribute('opacity',b*0.45); z1.setAttribute('y',40-Math.sin(t*0.7)*7); z2.setAttribute('y',24-Math.sin(t*0.7+.5)*7); z3.setAttribute('y',6-Math.sin(t*0.7+1)*7); zzzAnim=requestAnimationFrame(f); })(); }
function stopZZZ() { if(zzzAnim)cancelAnimationFrame(zzzAnim); document.getElementById('sleepZZZ').style.opacity = '0'; }

function resetInactivity() { 
  if(isSleeping) wakeUp(); 
  clearTimeout(inactTimer); clearTimeout(idleMoveTimer); clearTimeout(idleExprTimer);
  inactTimer = setTimeout(goToSleep, SLEEP_MS);
  scheduleIdleMove();
  scheduleIdleExpression();
}

// ── IDLE EXPRESSIONS ──
const IDLE_EXPRESSIONS = ['curious', 'happy', 'shy', 'loving', 'focused', 'neutral', 'surprised'];
function scheduleIdleExpression() {
  clearTimeout(idleExprTimer);
  idleExprTimer = setTimeout(() => {
    if (!isSleeping && !isBusy && !ttsActive && !isVideoPlaying) {
      const expr = IDLE_EXPRESSIONS[Math.floor(Math.random() * IDLE_EXPRESSIONS.length)];
      setEmotion(expr);
    }
    scheduleIdleExpression();
  }, IDLE_EXPR_MS + Math.random() * IDLE_EXPR_MS);
}

function scheduleIdleMove() {
  idleMoveTimer = setTimeout(() => {
    if (!isSleeping && !isBusy && bleConnected && !isVideoPlaying) {
       const roll = Math.random();
       if (roll > 0.85) {
           doWander(); 
       } else if (roll > 0.55) {
           // Medium movement
           const midMoves = ['F', 'B', 'L', 'R', 'N'];
           bleSend(midMoves[Math.floor(Math.random() * midMoves.length)]);
           setTimeout(() => bleSend('S'), 800);
       } else {
           // Small gesture
           const idleMoves = ['7', '8', 'E', 'C', 'A', 'V', 'U']; 
           bleSend(idleMoves[Math.floor(Math.random() * idleMoves.length)]);
       }
    }
    scheduleIdleMove();
  }, IDLE_MOVE_MIN + Math.random() * (IDLE_MOVE_MAX - IDLE_MOVE_MIN)); 
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
  initEyes(); resetInactivity(); scheduleIdleExpression(); initCamera(); loadHistory(); loadPersonalization(); updateKeyBadge(); updateMemoryPill(); applyMouthForEmotion('neutral');
  if (synth) { synth.getVoices(); synth.addEventListener('voiceschanged', () => synth.getVoices()); }
});
