'use strict';

// ════════════════════════════════════════════════════════
// CONFIG & THEMES
// ════════════════════════════════════════════════════════
const WAKE_WORDS   = ['ok petro','okay petro','hey petro'];
const SLEEP_MS     = 5 * 60 * 1000; 
const MAX_HISTORY = 50;
const GEMINI_URL   = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
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

// ─── BLE STRUCTURAL QUEUE UPGRADES ───
let bleQueue = [];
let isProcessingBleQueue = false;
let bleHeartbeatTimer = null;
let lastBleWriteTime = 0;
let lastSensorProcessTime = 0;

window.onYouTubeIframeAPIReady = function() {
  isYtApiReady = true;
};

// ════════════════════════════════════════════════════════
// FULLSCREEN & API, THEME & USAGE LOGIC
// ════════════════════════════════════════════════════════
async function toggleFullscreen() {
  if (!document.fullscreenElement) { 
    try { 
      await document.documentElement.requestFullscreen(); 
      if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(e => console.log('Orientation lock not supported')); 
    } catch(e) { toast('⚠️ Fullscreen not supported'); }
  } else { 
    try { await document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {} 
  }
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

function trackUsage(inTokens, outTokens) {
    let usage = JSON.parse(localStorage.getItem('petro_usage') || '{"in":0,"out":0,"req":0}');
    usage.in += inTokens; usage.out += outTokens; usage.req += 1;
    localStorage.setItem('petro_usage', JSON.stringify(usage));
    updateUsageUI();
}

// ════════════════════════════════════════════════════════
// BLUETOOTH MECHANICS
// ════════════════════════════════════════════════════════
function updateUsageUI() {
    const el = document.getElementById('usageBox'); if (!el) return;
    let usage = JSON.parse(localStorage.getItem('petro_usage') || '{"in":0,"out":0,"req":0}');
    const cost = ((usage.in / 1000000) * 0.075) + ((usage.out / 1000000) * 0.30);
    el.innerHTML = `Requests: <b>${usage.req}</b><br>Tokens: <b>${usage.in.toLocaleString()}</b> In / <b>${usage.out.toLocaleString()}</b> Out<br>Est. Cost: <b>$${cost.toFixed(5)}</b>`;
}

function clearUsage() {
    localStorage.removeItem('petro_usage'); updateUsageUI(); toast('🗑 Usage reset');
}

async function toggleBLE() {
  if (bleConnected) { disconnectBLE(); return; }
  if (!navigator.bluetooth) { toast('❌ Web Bluetooth not supported.'); return; }
  setBLE(null); toast('🔍 Scanning…');
  try { 
    bleDevice = await navigator.bluetooth.requestDevice({ filters: [{ name: BLE_NAME }], optionalServices: [BLE_SERVICE] }); 
  } catch(e1) { 
    if (e1.name === 'AbortError') { setBLE(false); return; } 
    try { 
      bleDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [BLE_SERVICE] }); 
    } catch(e2) { setBLE(false); toast('❌ No BLE devices found.'); return; } 
  }
  bleDevice.addEventListener('gattserverdisconnected', onBleDisconnect);
  toast(`🔗 Connecting to ${bleDevice.name}…`);
  try { 
    const server = await bleDevice.gatt.connect(); 
    const service = await server.getPrimaryService(BLE_SERVICE); 
    bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR); 
    setBLE(true); 
    toast(`✅ Connected!`); 
    updateBleInfoBox(); 
    resetInactivity();
    startBleHeartbeat();
  } catch(e) { 
    setBLE(false); 
    bleDevice = null; 
    toast('❌ Connection failed.'); 
  }
}

function disconnectBLE() { 
  stopBleHeartbeat();
  try { bleDevice?.gatt?.disconnect(); } catch {} 
  bleDevice = null; 
  bleCmdChar = null; 
  setBLE(false); 
  toast('Disconnected'); 
  updateBleInfoBox(); 
}

function onBleDisconnect() { 
  stopBleHeartbeat();
  if (!bleConnected) return; 
  setBLE(false); 
  toast('⚠️ petRO disconnected.'); 
  bleCmdChar = null; 
  updateBleInfoBox(); 
}

function setBLE(s) { 
  const b = document.getElementById('bleBtn'); 
  if (s === null) { b.className='badge ble-spin'; b.textContent='⟳ BLE…'; } 
  else if (s) { b.className='badge ble-on'; b.textContent='🟢 BLE'; } 
  else { b.className='badge ble-off'; b.textContent='⚫ BLE'; } 
  bleConnected = !!s; 
}

function updateBleInfoBox() { 
  const el = document.getElementById('bleInfoBox'); if (!el) return; 
  el.innerHTML = (bleConnected && bleDevice) ? `Status: <span style="color:var(--green)">Connected ✓</span>` : `Status: <span style="color:var(--red)">Not connected</span>`; 
}

function bleSend(cmd) {
  if (!bleConnected || !bleCmdChar) return;
  
  hardwareActive = true; 
  clearTimeout(hwTimeout); 
  hwTimeout = setTimeout(() => { if(!isMoving) hardwareActive = false; }, 3000);

  bleQueue.push(cmd);
  processBleQueue();
}

async function processBleQueue() {
  if (isProcessingBleQueue || bleQueue.length === 0) return;
  isProcessingBleQueue = true;

  while (bleQueue.length > 0) {
    const currentCmd = bleQueue[0];
    
    if (!bleDevice?.gatt?.connected || !bleCmdChar) {
      setBLE(false);
      bleQueue = [];
      isProcessingBleQueue = false;
      return;
    }

    try {
      const now = performance.now();
      const delta = now - lastBleWriteTime;
      if (delta < 35) {
        await new Promise(r => setTimeout(r, 35 - delta));
      }

      await bleCmdChar.writeValueWithoutResponse(new TextEncoder().encode(currentCmd));
      lastBleWriteTime = performance.now();
      bleQueue.shift(); 
    } catch (e) {
      console.warn("GATT Operational Write Collision:", e);
      if (!bleDevice?.gatt?.connected) {
         setBLE(false);
         bleQueue = [];
         isProcessingBleQueue = false;
         return;
      }
      await new Promise(r => setTimeout(r, 50));
    }
  }
  isProcessingBleQueue = false;
}

function startBleHeartbeat() {
  stopBleHeartbeat();
  bleHeartbeatTimer = setInterval(() => {
    if (bleConnected && !isMoving && !hardwareActive && (performance.now() - lastBleWriteTime > 8000)) {
      bleSend('S'); 
    }
  }, 5000);
}

function stopBleHeartbeat() {
  if (bleHeartbeatTimer) {
    clearInterval(bleHeartbeatTimer);
    bleHeartbeatTimer = null;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════
// DIRECT MOVEMENT & HARDWARE ACTIONS (REVISED)
// ════════════════════════════════════════════════════════
let isMoving = false;
async function startDirectMove(cmd) { if (!bleConnected) { toast('⚠️ Connect BLE first!'); return; } resetInactivity(); isMoving = true; bleSend(cmd); }
async function stopDirectMove() { if (!isMoving || !bleConnected) return; isMoving = false; bleSend('S'); }

async function doAction(action) {
  if (!bleConnected) { toast('⚠️ Connect BLE first!'); return; }
  resetInactivity();
  switch(action) { 
    case 'nod': 
      bleSend('N'); 
      await sleep(2000); 
      break; 
    case 'dance': 
      await doDance(); 
      break; 
    case 'wander': 
      await doWander(); 
      break; 
  }
}

async function doDance() { 
  toast('💃 Dancing!'); 
  setEmotion('excited'); 
  
  hardwareActive = true;
  isMoving = true;
  
  for (const [cmd, ms] of DANCE_STEPS) { 
    if (!bleConnected) break;
    bleSend(cmd); 
    if (ms > 0) await sleep(ms); 
  } 
  
  isMoving = false;
  hardwareActive = false;
  toast('🎉 Done!'); 
}

async function doWander() { 
  toast('🗺 Wandering!'); 
  setEmotion('focused'); 
  
  hardwareActive = true;
  isMoving = true;
  
  bleSend('W'); 
  await sleep(4000); 
  
  bleSend('S');
  await sleep(100);
  
  isMoving = false;
  hardwareActive = false;
  toast('✅ Done'); 
}

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
    
    const now = performance.now();
    if (now - lastSensorProcessTime < 100) return;
    lastSensorProcessTime = now;

    let acc = e.accelerationIncludingGravity; if(!acc) return; 
    let total = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z); 
    if(Math.abs(total - lastAccel) > 25) { setEmotion('dizzy'); resetInactivity(); } 
    lastAccel = total; 
  });
  window.addEventListener('deviceorientation', (e) => { 
    if(isSleeping || !motionEnabled || isMoving || hardwareActive) return;
    
    const now = performance.now();
    if (now - lastSensorProcessTime < 100) return;
    lastSensorProcessTime = now;

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

function stopGroove() { clearInterval(grooveTimer); grooveTimer = null; bleSend('E'); }

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
  if (pattern === 'circle') { bleSend('L'); await sleep(3500); bleSend('S'); } 
  else if (pattern === 'rectangle') { for (let i=0; i<4; i++) { bleSend('F'); await sleep(1000); bleSend('R'); await sleep(600); } bleSend('S'); } 
  else if (pattern === 'moonwalk') { for (let i=0; i<4; i++) { bleSend('B'); await sleep(500); bleSend('S'); await sleep(200); } } 
  else if (pattern === 'spin') { bleSend('L'); await sleep(1500); bleSend('S'); }
}

// ════════════════════════════════════════════════════════
// TOOL EXECUTION
// ════════════════════════════════════════════════════════
async function executeTools(toolCalls) {
  for (const tc of toolCalls) {
    const args = tc.args || {};
    switch(tc.name) {
      case 'move_forward':  bleSend('F'); await sleep((args.duration_seconds || 1) * 1000); bleSend('S'); await sleep(100); break;
      case 'move_backward': bleSend('B'); await sleep((args.duration_seconds || 1) * 1000); bleSend('S'); await sleep(100); break;
      case 'turn_left':     bleSend('L'); await sleep((args.duration_seconds || 0.5) * 1000); bleSend('S'); await sleep(100); break;
      case 'turn_right':    bleSend('R'); await sleep((args.duration_seconds || 0.5) * 1000); bleSend('S'); await sleep(100); break;
      case 'stop_robot':    bleSend('S'); break;
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
function runEyeLoop() { function f() { Object.keys(eyeOff).forEach(k => eyeOff[k] += (eyeTgt[k] - eyeOff[k]) * 0.25); if (eyeEls.lIris) { eyeEls.lIris.setAttribute('cx', 120 + eyeOff.lx); eyeEls.lIris.setAttribute('cy', 110 + eyeOff.ly); eyeEls.lPupil.setAttribute('cx', 120 + eyeOff.lx * 1.2); eyeEls.lPupil.setAttribute('cy', 110 + eyeOff.ly * 1.2); eyeEls.lHL1.setAttribute('cx', 110 + eyeOff.lx * 1.3); eyeEls.lHL1.setAttribute('cy', 100 + eyeOff.ly * 1.3); eyeEls.lHL2.setAttribute('cx', 130 + eyeOff.lx * 1.1); eyeEls.lHL2.setAttribute('cy', 120 + eyeOff.ly * 1.1); } if (eyeEls.rIris) { eyeEls.rIris.setAttribute('cx', 280 + eyeOff.rx); eyeEls.rIris.setAttribute('cy', 110 + eyeOff.ry); eyeEls.rPupil.setAttribute('cx', 280 + eyeOff.rx * 1.2); eyeEls.rPupil.setAttribute('cy', 110 + eyeOff.ry * 1.2); eyeEls.rHL1.setAttribute('cx', 270 + eyeOff.rx * 1.3); eyeEls.rHL1.setAttribute('cy', 100 + eyeOff.ry * 1.3); eyeEls.rHL2.setAttribute('cx', 290 + eyeOff.rx * 1.1); eyeEls.rHL2.setAttribute('cy', 120 + eyeOff.ry * 1.1); } requestAnimationFrame(f); } f(); }
function scheduleBlink() { if(blinkTimer) clearTimeout(blinkTimer); blinkTimer = setTimeout(async () => { if(!isSleeping && currentEmotion !== 'dizzy' && currentEmotion !== 'afraid' && currentEmotion !== 'dead') { await setLids(90, 90); await sleep(90); await setLids(emotions[currentEmotion]?.lids || 0, emotions[currentEmotion]?.lids || 0); } scheduleBlink(); }, 2500 + Math.random() * 3000); }
function scheduleEyeMove() { setTimeout(() => { if(!isSleeping && Math.random() > 0.3 && !['dizzy','afraid','dead','focused'].includes(currentEmotion)) { const mx = (Math.random() - 0.5) * 16, my = (Math.random() - 0.5) * 10; eyeTgt = { lx:mx, ly:my, rx:mx, ry:my }; } scheduleEyeMove(); }, 1500 + Math.random() * 2000); }
function setLids(top, bot) { return new Promise(r => { if (!eyeEls.lLidTop) return r(); eyeEls.lLidTop.setAttribute('height', top); eyeEls.lLidBot.setAttribute('height', bot); eyeEls.lLidBot.setAttribute('y', 160 - bot); eyeEls.rLidTop.setAttribute('height', top); eyeEls.rLidBot.setAttribute('height', bot); eyeEls.rLidBot.setAttribute('y', 160 - bot); setTimeout(r, 40); }); }

const emotions = {
  neutral:   { lids: 5,  brow: 0,   mouthType: 'smile', mouthOpen: 0,   color: null },
  happy:     { lids: 0,  brow: -6,  mouthType: 'smile', mouthOpen: 12,  color: null },
  loving:    { lids: 15, brow: -4,  mouthType: 'smile', mouthOpen: 8,   color: '#ff4081' },
  excited:   { lids: 0,  brow: -10, mouthType: 'smile', mouthOpen: 25,  color: null },
  sad:       { lids: 45, brow: 10,  mouthType: 'sad',   mouthOpen: 10,  color: '#5c6bc0' },
  angry:     { lids: 40, brow: 15,  mouthType: 'sad',   mouthOpen: 5,   color: '#ef5350' },
  surprised: { lids: 0,  brow: -14, mouthType: 'circle',mouthOpen: 30,  color: null },
  shy:       { lids: 30, brow: -2,  mouthType: 'smile', mouthOpen: 0,   color: '#ff8a80' },
  focused:   { lids: 35, brow: 4,   mouthType: 'line',  mouthOpen: 0,   color: null },
  dizzy:     { lids: 20, brow: 0,   mouthType: 'wave',  mouthOpen: 10,  color: '#7e57c2' },
  afraid:    { lids: 10, brow: 8,   mouthType: 'wave',  mouthOpen: 20,  color: '#26a69a' },
  sleeping:  { lids: 85, brow: 0,   mouthType: 'line',  mouthOpen: 0,   color: '#37474f' },
  dead:      { lids: 60, brow: 12,  mouthType: 'line',  mouthOpen: 0,   color: '#212121' }
};

function setEmotion(emName, force = false) {
  if (isSleeping && !force) return; if(emotionResetTimer) clearTimeout(emotionResetTimer);
  currentEmotion = emotions[emName] ? emName : 'neutral'; const em = emotions[currentEmotion];
  setLids(em.lids, em.lids);
  if (eyeEls.lBrow) { eyeEls.lBrow.style.transform = `translateY(${em.brow}px) rotate(${em.brow*0.8}deg)`; eyeEls.rBrow.style.transform = `translateY(${em.brow}px) rotate(${-em.brow*0.8}deg)`; }
  applyMouthForEmotion(currentEmotion);
  const faceBg = document.getElementById('faceBg'); if (faceBg) faceBg.style.fill = em.color || 'var(--bg)';
  
  if (bleConnected && !force) {
     const hwCode = emName.substring(0,2).toUpperCase();
     bleSend(`E${hwCode}`);
  }
  
  if (!['neutral','sleeping','dead'].includes(currentEmotion) && !force) { emotionResetTimer = setTimeout(() => setEmotion('neutral'), 6000); }
}

function applyMouthForEmotion(emName) { const em = emotions[emName] || emotions.neutral; if (!ttsActive) setMouthPath(em.mouthType, em.mouthOpen); }
function setMouthPath(type, openVal) {
  const pathEl = document.getElementById('mouthPath'); if (!pathEl) return;
  let d = '';
  if (type === 'smile') { const cx = 200, cy = 200 + (openVal*0.2), w = 50, h = 15 + openVal; d = `M ${cx - w} ${cy} Q ${cx} ${cy + h} ${cx + w} ${cy} Q ${cx} ${cy + (h * 0.3)} ${cx - w} ${cy} Z`; } 
  else if (type === 'sad') { const cx = 200, cy = 220, w = 45, h = 15 + openVal; d = `M ${cx - w} ${cy} Q ${cx} ${cy - h} ${cx + w} ${cy} Q ${cx} ${cy - (h * 0.3)} ${cx - w} ${cy} Z`; } 
  else if (type === 'circle') { const r = 10 + openVal*0.6; d = `M 200 ${210 - r} A ${r} ${r} 0 1 0 200 ${210 + r} A ${r} ${r} 0 1 0 200 ${210 - r} Z`; } 
  else if (type === 'line') { const w = 40 + openVal*0.2; d = `M ${200 - w} 210 L ${200 + w} 210 L ${200 + w} 213 L ${200 - w} 213 Z`; } 
  else if (type === 'wave') { const w = 45; d = `M ${200 - w} 210 Q 180 ${210 + openVal} 200 210 T ${200 + w} 210 L ${200 + w} 212 Q 220 ${212 + openVal} 200 212 T ${200 - w} 212 Z`; }
  pathEl.setAttribute('d', d);
}

// ════════════════════════════════════════════════════════
// STT / MIC LISTENER MECHANISMS
// ════════════════════════════════════════════════════════
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
function initSTT() {
  if (!SpeechRec) { document.getElementById('micBtn').style.display = 'none'; return; }
  bgRecog = new SpeechRec(); bgRecog.continuous = true; bgRecog.interimResults = false; bgRecog.lang = 'en-US';
  bgRecog.onresult = e => {
    if (isBusy || isSleeping || isVideoPlaying) return; const t = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
    if (WAKE_WORDS.some(ww => t.includes(ww))) { triggerWake(); }
  };
  bgRecog.onerror = () => { if (alwaysOnMic && !isBusy && !isVideoPlaying) try { bgRecog.start(); } catch{} };
  bgRecog.onend = () => { if (alwaysOnMic && !isBusy && !isVideoPlaying) try { bgRecog.start(); } catch{} };

  cmdRecog = new SpeechRec(); cmdRecog.continuous = false; cmdRecog.interimResults = false; cmdRecog.lang = 'en-US';
  cmdRecog.onstart = () => updateMicBadge('listening');
  cmdRecog.onresult = e => { const t = e.results[0][0].transcript.trim(); if (t) { appendMsg('user', t); doChat(t); } };
  cmdRecog.onend = () => { updateMicBadge(alwaysOnMic ? 'wake' : 'off'); if (alwaysOnMic && !isBusy && !isVideoPlaying) startBgListen(); };
  cmdRecog.onerror = () => { toast('🎤 Mic error / timed out'); };
}

function startBgListen() { try { cmdRecog.stop(); } catch{} try { bgRecog.start(); } catch{} micState = 'wake'; }
function stopAllRecog() { try { bgRecog.stop(); } catch{} try { cmdRecog.stop(); } catch{} micState = 'off'; }
function triggerWake() { stopTTS(); stopAllRecog(); setEmotion('excited'); try { const a = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg'); a.volume = 0.3; a.play(); } catch{} setTimeout(() => { try { cmdRecog.start(); micState = 'listening'; } catch{} }, 350); }
function toggleMicMode() {
  if (isVideoPlaying) { toast('⚠️ Media active. Close video first.'); return; }
  if (!SpeechRec) { toast('❌ Speech API unvailable'); return; }
  if (!alwaysOnMic && micState === 'off') { alwaysOnMic = true; startBgListen(); toast('🎤 Always-On Mode Active'); } 
  else if (alwaysOnMic && micState === 'wake') { stopAllRecog(); try { cmdRecog.start(); micState = 'listening'; } catch{} alwaysOnMic = false; toast('🎤 Manual Mic Triggered'); } 
  else { alwaysOnMic = false; stopAllRecog(); updateMicBadge('off'); toast('🎤 Mic Turned Off'); }
}
function updateMicBadge(st) { const b = document.getElementById('micBtn'); if (st === 'listening') { b.className = 'icon-btn mic-listening'; b.innerHTML = '🔴'; } else if (st === 'wake') { b.className = 'icon-btn mic-wake'; b.innerHTML = '👂'; } else { b.className = 'icon-btn'; b.innerHTML = '🎤'; } }

// ════════════════════════════════════════════════════════
// SLEEP / WAKE SYSTEM
// ════════════════════════════════════════════════════════
function resetInactivity() { clearTimeout(inactTimer); inactTimer = setTimeout(goToSleep, SLEEP_MS); if (isSleeping) wakeUp(); }
function goToSleep() { if (isSleeping) return; isSleeping = true; stopTTS(); stopAllRecog(); stopGroove(); setEmotion('sleeping', true); let z = 0; zzzAnim = setInterval(() => { z++; toast('💤 ' + 'Z'.repeat((z % 3) + 1)); }, 3000); toast('💤 Going to sleep...'); bleSend('Z'); }
function wakeUp() { if (!isSleeping) return; isSleeping = false; clearInterval(zzzAnim); setEmotion('neutral', true); toast('☀️ Awake!'); if (alwaysOnMic && !isVideoPlaying) startBgListen(); bleSend('A'); resetInactivity(); }

// ════════════════════════════════════════════════════════
// FOLLOW UP AUTO QUESTIONS ENGINE
// ════════════════════════════════════════════════════════
function startFollowUp() {
    if (isBusy || isVideoPlaying || followUpActive) return;
    const config = document.getElementById('followUpSelect').value || '0';
    if (config === '0') return;
    
    clearTimeout(followUpTimeout);
    followUpTimeout = setTimeout(async () => {
        if (isBusy || isVideoPlaying || ttsActive) return;
        followUpActive = true;
        
        const apiKey = getApiKey(); if (!apiKey) { followUpActive = false; return; }
        const prompt = "The user has been quiet for a moment. Ask a short, engaging, single-sentence question to continue our conversation based on history, or suggest something fun to do together. Keep it short!";
        
        try {
            const body = { system_instruction: { parts: [{ text: buildSystemPrompt() }] }, contents: [{role: 'user', parts:[{text: prompt}]}], generationConfig: { temperature: 0.8, maxOutputTokens: 100 } };
            const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            if (resp.ok) {
                const data = await resp.json();
                const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (reply && !isBusy && !isVideoPlaying) {
                    appendMsg('bot', reply.trim());
                    speak(reply.trim());
                }
            }
        } catch (e) { console.log("Follow-up skipped:", e); }
        finally { followUpActive = false; }
    }, parseInt(config) * 1000);
}

// ════════════════════════════════════════════════════════
// CORE UI PIPELINES & ENTRY
// ════════════════════════════════════════════════════════
function appendMsg(role, text, tools = []) {
  const c = document.getElementById('messages'), el = document.createElement('div'); el.className = `msg ${role}`;
  const lbl = document.createElement('div'); lbl.className = 'msg-label'; lbl.textContent = role === 'user' ? (localStorage.getItem('petro_user_name') || 'User') : 'petRO 🤖'; el.appendChild(lbl);
  const bub = document.createElement('div'); bub.className = 'msg-bubble'; bub.textContent = text;
  if (tools.length > 0) { const tBox = document.createElement('div'); tBox.className = 'tool-calls'; tools.forEach(t => { tBox.innerHTML += `<span class="tool-pill">⚙️ ${t}</span>`; }); bub.appendChild(tBox); }
  el.appendChild(bub); c.appendChild(el); c.scrollTop = c.scrollHeight;
}
function showTyping() { const c = document.getElementById('messages'), el = document.createElement('div'); el.className = 'msg bot typing-indicator'; el.innerHTML = `<div class="msg-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`; c.appendChild(el); c.scrollTop = c.scrollHeight; return el; }
function removeTyping(el) { el?.remove(); }
function toast(msg) { clearTimeout(toastTimer); const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('show'); toastTimer = setTimeout(() => el.classList.remove('show'), 3000); }

function handleKeyDown(e) { if (e.key === 'Enter') sendChat(); }

window.addEventListener('DOMContentLoaded', () => {
  initEyes(); initSTT(); initCamera(); loadPersonalization(); loadHistory(); updateKeyBadge(); updateMemoryPill();
  
  document.getElementById('userInput').addEventListener('keydown', handleKeyDown);
  document.body.addEventListener('pointerdown', () => resetInactivity());
  
  // Set up touch handlers safely mapped to prevent browser lockouts
  const btnMap = { btnF:'F', btnB:'B', btnL:'L', btnR:'R' };
  Object.entries(btnMap).forEach(([id, cmd]) => {
    const el = document.getElementById(id); if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); startDirectMove(cmd); });
    el.addEventListener('pointerup', (e) => { e.preventDefault(); stopDirectMove(); });
    el.addEventListener('pointerleave', (e) => { e.preventDefault(); stopDirectMove(); });
  });

  // Passive ambient animation loop
  setInterval(() => {
    if (!bleConnected || isSleeping || isMoving || hardwareActive || Math.random() > 0.2) return;
    const p = ['circle', 'moonwalk', 'spin'];
    const selected = p[Math.floor(Math.random() * p.length)];
    if(Math.random() > 0.85) doPattern(selected);
  }, 15000);
  
  resetInactivity();
});
