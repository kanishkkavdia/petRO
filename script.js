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
const BLE_HB_CHAR  = '00005679-0000-1000-8000-00805f9b34fb';
const BLE_NAME     = 'petRO';

const THEMES = {
  default: { color: '#3b9eff', bg: '#090d18', surface: '#101623', card: '#141e30', prompt: "You are petRO, a cute and playful robot. Be playful, warm, and fun. Keep replies SHORT." },
  dog: { color: '#ff9800', bg: '#1a1005', surface: '#2b1b0a', card: '#3d2610', prompt: "You are an energetic and loyal robot dog. Bark playfully in text. Keep replies SHORT." },
  terminator: { color: '#ff3333', bg: '#0a0000', surface: '#1a0000', card: '#2a0505', prompt: "You are a calculating cyborg T-800. Speak concisely. Keep replies SHORT." },
  monkey: { color: '#8bc34a', bg: '#0a1205', surface: '#13240a', card: '#1c360e', prompt: "You are a cheeky, energetic robot monkey. Make monkey sounds. Keep replies SHORT." },
  starwars: { color: '#00e5ff', bg: '#000814', surface: '#00122e', card: '#001c47', prompt: "You are a helpful astromech droid. Make beep-boop sounds. Keep replies SHORT." },
  transformer: { color: '#f44336', bg: '#0d1017', surface: '#181d29', card: '#222a3b', prompt: "You are Optimus Prime, a noble Autobot leader. Speak with deep authority. Keep replies SHORT." }
};

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════
let bleDevice = null, bleCmdChar = null, bleConnected = false, isBusy = false;
let currentEmotion = 'neutral', emotionResetTimer = null, isSleeping = false;
let micState = 'off', alwaysOnMic = false, bgRecog = null, cmdRecog = null;
let inactTimer = null, fidgetTimer = null, zzzAnim = null, blinkTimer = null;
let videoStream = null, currentUploadedImage = null;
let ttsActive = false, mouthTalkAnim = null, toastTimer = null;
let chatHistory = [], motionEnabled = false;

// ... (Fullscreen, Personalization, BLE Setup logic remains unchanged) ...
async function toggleFullscreen() { if (!document.fullscreenElement) { try { await document.documentElement.requestFullscreen(); if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(e => console.log('Orientation lock not supported')); } catch(e) { toast('⚠️ Fullscreen not supported on this browser'); } } else { try { await document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {} } }
function getApiKey() { return localStorage.getItem('petro_gemini_key') || ''; }
function saveApiKey() { const v = document.getElementById('apiKeyInput').value.trim(); if (!v) { toast('⚠️ Please paste a key first'); return; } localStorage.setItem('petro_gemini_key', v); updateKeyBadge(); toast('✅ Key saved!'); closeSettings(); }
function clearApiKey() { localStorage.removeItem('petro_gemini_key'); document.getElementById('apiKeyInput').value = ''; updateKeyBadge(); toast('🗑 Key removed'); }
function updateKeyBadge() { const k = getApiKey(); const badge = document.getElementById('keyBadge'); const status = document.getElementById('keyStatus'); if (k) { badge.className = 'badge key-set'; badge.textContent = '🔑 KEY ✓'; status.className = 'key-status ok'; status.textContent = `Key saved: ${k.slice(0,8)}…`; } else { badge.className = 'badge key-missing'; badge.textContent = '🔑 KEY'; status.className = 'key-status bad'; status.textContent = 'No key saved'; } }
function toggleKeyVisibility() { const inp = document.getElementById('apiKeyInput'); const btn = document.getElementById('eyeBtn'); if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; } else { inp.type = 'password'; btn.textContent = '👁'; } }
function loadPersonalization() { const name = localStorage.getItem('petro_user_name') || ''; const theme = localStorage.getItem('petro_theme') || 'default'; document.getElementById('userNameInput').value = name; document.getElementById('themeSelect').value = theme; applyTheme(); }
function savePersonalization() { const name = document.getElementById('userNameInput').value.trim(); const theme = document.getElementById('themeSelect').value; localStorage.setItem('petro_user_name', name); localStorage.setItem('petro_theme', theme); applyTheme(); toast('✅ Identity & Theme Saved!'); }
function applyTheme() { const tId = document.getElementById('themeSelect').value || 'default'; const t = THEMES[tId]; const root = document.documentElement; root.style.setProperty('--theme-color', t.color); root.style.setProperty('--bg', t.bg); root.style.setProperty('--surface', t.surface); root.style.setProperty('--card', t.card); document.getElementById('stop1-2').setAttribute('stop-color', t.color); document.getElementById('stop2-2').setAttribute('stop-color', t.color); document.getElementById('lGlow').setAttribute('stroke', t.color); document.getElementById('rGlow').setAttribute('stroke', t.color); const addons = ['dog', 'terminator', 'monkey', 'starwars', 'transformer']; addons.forEach(addon => { const el = document.getElementById('theme-' + addon); if (el) el.style.opacity = (tId === addon) ? '1' : '0'; }); const mouthGroup = document.getElementById('mouthGroup'); const mouthRim = document.getElementById('mouthRim'); if (tId === 'transformer') { mouthGroup.style.opacity = '0'; mouthRim.style.opacity = '0'; } else { mouthGroup.style.opacity = '1'; mouthRim.style.opacity = '1'; } if (currentEmotion === 'neutral') setEmotion('neutral', true); }
function openSettings() { const k = getApiKey(); if (k) document.getElementById('apiKeyInput').value = k; document.getElementById('settingsModal').classList.add('open'); updateKeyBadge(); updateBleInfoBox(); updateMemoryPill(); }
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }
document.getElementById('settingsModal').addEventListener('click', function(e) { if (e.target === this) closeSettings(); });

async function toggleBLE() {
  if (bleConnected) { disconnectBLE(); return; }
  if (!navigator.bluetooth) { toast('❌ Web Bluetooth not supported.'); return; }
  setBLE(null); toast('🔍 Scanning…');
  try { bleDevice = await navigator.bluetooth.requestDevice({ filters: [{ name: BLE_NAME }], optionalServices: [BLE_SERVICE] }); } catch(e1) { if (e1.name === 'AbortError') { setBLE(false); return; } toast('⚠️ Name scan failed. Showing all devices…'); try { bleDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [BLE_SERVICE] }); } catch(e2) { setBLE(false); toast('❌ No BLE devices found.'); return; } }
  bleDevice.addEventListener('gattserverdisconnected', onBleDisconnect);
  toast(`🔗 Connecting to ${bleDevice.name}…`);
  try { const server = await bleDevice.gatt.connect(); const service = await server.getPrimaryService(BLE_SERVICE); bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR); setBLE(true); toast(`✅ Connected!`); updateBleInfoBox(); resetInactivity(); } catch(e) { setBLE(false); bleDevice = null; toast('❌ Connection failed.'); }
}

function disconnectBLE() { try { bleDevice?.gatt?.disconnect(); } catch {} bleDevice = null; bleCmdChar = null; setBLE(false); toast('Disconnected'); updateBleInfoBox(); }
function onBleDisconnect() { if (!bleConnected) return; setBLE(false); toast('⚠️ petRO disconnected.'); bleCmdChar = null; updateBleInfoBox(); }
function setBLE(s) { const b = document.getElementById('bleBtn'); if (s === null) { b.className='badge ble-spin'; b.textContent='⟳ BLE…'; } else if (s) { b.className='badge ble-on'; b.textContent='🟢 BLE'; } else { b.className='badge ble-off'; b.textContent='⚫ BLE'; } bleConnected = !!s; }
function updateBleInfoBox() { const el = document.getElementById('bleInfoBox'); if (!el) return; if (bleConnected && bleDevice) el.innerHTML = `Status: <span style="color:var(--green)">Connected ✓</span>`; else el.innerHTML = `Status: <span style="color:var(--red)">Not connected</span>`; }
async function bleSend(cmd) { if (!bleCmdChar) return; if (!bleDevice?.gatt?.connected) { try { const server = await bleDevice.gatt.connect(); const service = await server.getPrimaryService(BLE_SERVICE); bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR); setBLE(true); } catch(e) { setBLE(false); return; } } try { await bleCmdChar.writeValueWithoutResponse(new TextEncoder().encode(cmd)); } catch(e) { setBLE(false); bleCmdChar = null; } }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════
// DIRECT MOVE & ANIMATIONS
// ════════════════════════════════════════════════════════
let isMoving = false;
async function startDirectMove(cmd) { if (!bleConnected) { toast('⚠️ Connect BLE first!'); return; } resetInactivity(); isMoving = true; await bleSend(cmd); }
async function stopDirectMove() { if (!isMoving || !bleConnected) return; isMoving = false; await bleSend('S'); }

async function doAction(action) {
  if (!bleConnected) { toast('⚠️ Connect BLE first!'); return; }
  resetInactivity();
  switch(action) {
    case 'nod':      await bleSend('N'); await sleep(2000); break;
    case 'dance':    await doDance(); break;
    case 'wander':   await doWander(); break;
  }
}

// UPDATED: Incorporates left/right neck movement and spin
async function doDance() { 
  toast('💃 Dancing!'); setEmotion('excited'); 
  const moves = [
    ['A',400], ['L',500], ['S',100],  // Look left, spin left
    ['C',400], ['R',500], ['S',100],  // Look right, spin right
    ['E',100], ['F',350], ['B',350],  // Look center, forward/back
    ['N',1500],['K',2000]             // Nod, then Neck Dance
  ];
  for (const [cmd, ms] of moves) { await bleSend(cmd); if (ms > 0) await sleep(ms); } 
  await bleSend('S'); await bleSend('E'); toast('🎉 Done!'); 
}

// UPDATED: Looks around before deciding where to move
async function doWander() { 
  toast('🗺 Wandering!'); setEmotion('focused'); 
  const moves = ['F','B','L','R']; 
  for (let i = 0; i < 5; i++) { 
    await bleSend(Math.random() > 0.5 ? 'A' : 'C'); await sleep(400); // Look around
    await bleSend('E'); await sleep(100);                             // Face front
    const c = moves[Math.floor(Math.random() * moves.length)]; 
    const d = 300 + Math.random() * 500; 
    await bleSend(c); await sleep(d); await bleSend('S'); await sleep(150); 
  } 
  await bleSend('S'); toast('✅ Done'); 
}

// ════════════════════════════════════════════════════════
// CONTEXTUAL OVERLAY (Eating, Studying, Working, Gym)
// ════════════════════════════════════════════════════════
function showActivityOverlay(activity) {
  const icons = { eating: '🍔', working: '💻', studying: '📚', working_out: '🏋️' };
  const icon = icons[activity] || '✨';
  
  const el = document.createElement('div');
  el.textContent = icon;
  el.style.cssText = 'position:absolute; top:30%; left:50%; transform:translateX(-50%); font-size:6rem; z-index:500; animation: bouncePop 3.5s ease forwards; text-shadow: 0 4px 15px rgba(0,0,0,0.4); pointer-events:none;';
  document.getElementById('faceScreen').appendChild(el);
  
  if (!document.getElementById('activityStyle')) {
    const style = document.createElement('style');
    style.id = 'activityStyle';
    style.textContent = `@keyframes bouncePop { 0% { opacity:0; transform: translate(-50%, 20px) scale(0.5); } 15% { opacity:1; transform: translate(-50%, -20px) scale(1.2); } 25% { transform: translate(-50%, 0px) scale(1); } 80% { opacity:1; transform: translate(-50%, 0px) scale(1); } 100% { opacity:0; transform: translate(-50%, -30px) scale(0.8); } }`;
    document.head.appendChild(style);
  }
  
  setTimeout(() => el.remove(), 3500);
  
  // Physical Reaction parallel to animation
  if (bleConnected) {
    if (activity === 'eating') { setEmotion('happy'); bleSend('H'); } // Happy dance
    else if (activity === 'studying' || activity === 'working') { setEmotion('focused'); bleSend('V'); } // Tilt head to focus
    else if (activity === 'working_out') { setEmotion('excited'); bleSend('6'); } // Shake head to hype up
  }
}

// ════════════════════════════════════════════════════════
// GYROSCOPE
// ════════════════════════════════════════════════════════
function enableMotionSensors() { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { DeviceOrientationEvent.requestPermission().then(response => { if (response == 'granted') { motionEnabled = true; bindSensors(); toast('✅ Motion Synced'); document.getElementById('gyroBtn').style.display='none'; } else toast('❌ Permission denied'); }).catch(console.error); } else { motionEnabled = true; bindSensors(); toast('✅ Motion Synced'); document.getElementById('gyroBtn').style.display='none'; } }
let lastAccel = 0;
function bindSensors() { window.addEventListener('devicemotion', (e) => { if(isSleeping || !motionEnabled) return; let acc = e.accelerationIncludingGravity; if(!acc) return; let total = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z); if(Math.abs(total - lastAccel) > 16) { setEmotion('dizzy'); resetInactivity(); } lastAccel = total; }); window.addEventListener('deviceorientation', (e) => { if(isSleeping || !motionEnabled) return; if(Math.abs(e.beta) > 60 || Math.abs(e.gamma) > 60) { if(currentEmotion !== 'afraid') setEmotion('afraid'); resetInactivity(); } }); }

// ════════════════════════════════════════════════════════
// GEMINI AGENT & SYSTEM PROMPT BUILDER
// ════════════════════════════════════════════════════════
function buildSystemPrompt() {
  const uName = localStorage.getItem('petro_user_name') || '';
  const tId   = localStorage.getItem('petro_theme') || 'default';
  const theme = THEMES[tId];
  
  let p = theme.prompt;
  if (uName) p = `You are talking to your owner/friend named: ${uName}. ` + p;
  
  p += `
AVAILABLE FUNCTIONS:
  move_forward, move_backward, turn_left, turn_right, stop_robot
  dance(), nod_head(), wander(), capture_photo(), search_youtube(), call_contact()
  perform_action(action)          → execute character animations: 'happy', 'scared', 'shake', 'neck_dance', 'spin', 'reverse_nod'
  draw_shape(shape)               → move in a physical shape: 'circle', 'rectangle'
  dance_style(style)              → specific dances: 'michael_jackson'
  react_to_activity(activity)     → USE THIS if user mentions or sends a picture of them eating, studying, working, or working out to spawn 3D objects on screen!

WHEN TO CALL:
  "i am eating a burger"                       → [react_to_activity("eating")]
  "doing my homework"                          → [react_to_activity("studying")]
  "dance like michael jackson"                 → [dance_style("michael_jackson")]
  "make a circle shape"                        → [draw_shape("circle")]
  "look left then move forward"                → [perform_action("look_left"), move_forward(2)]

VISION: Always describe image contents enthusiastically if user attaches one. IF the image shows them working, eating, etc, call react_to_activity!
EMOTION HINTS: append ONE tag: [emotion:neutral], [emotion:happy], [emotion:excited], [emotion:sad], [emotion:angry], [emotion:focused]`;
  return p;
}

const TOOL_DECLARATIONS = [
  { name:'move_forward',  parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER'} }} },
  { name:'move_backward', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER'} }} },
  { name:'turn_left',     parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER'} }} },
  { name:'turn_right',    parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER'} }} },
  { name:'stop_robot',    parameters:{type:'OBJECT',properties:{}} },
  { name:'dance',         parameters:{type:'OBJECT',properties:{}} },
  { name:'nod_head',      parameters:{type:'OBJECT',properties:{ times: {type: 'INTEGER'} }} },
  { name:'wander',        parameters:{type:'OBJECT',properties:{}} },
  { name:'capture_photo', parameters:{type:'OBJECT',properties:{}} },
  { name:'search_youtube',parameters:{type:'OBJECT',properties:{query:{type:'STRING'}},required:['query']} },
  { name:'call_contact',  parameters:{type:'OBJECT',properties:{ phone_number: {type: 'STRING'} }, required:['phone_number']} },
  { name:'perform_action', parameters:{type:'OBJECT',properties:{ action: {type: 'STRING', enum:['happy','scared','shake','neck_dance','spin','reverse_nod', 'look_left', 'look_right']} }, required:['action']} },
  { name:'draw_shape',    parameters:{type:'OBJECT',properties:{ shape: {type: 'STRING', enum:['circle','rectangle']} }, required:['shape']} },
  { name:'dance_style',   parameters:{type:'OBJECT',properties:{ style: {type: 'STRING', enum:['michael_jackson']} }, required:['style']} },
  { name:'react_to_activity', parameters:{type:'OBJECT',properties:{ activity: {type: 'STRING', enum:['eating','working','studying','working_out']} }, required:['activity']} }
];

async function callGemini(userText, imageDataUrl = null) {
  const apiKey = getApiKey();
  if (!apiKey) { toast('⚠️ Set API key in Settings'); openSettings(); throw new Error('No API key'); }

  const contents = chatHistory.map(m => {
    const parts = [{ text: m.text }];
    if (m.imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: m.imageBase64.replace(/^data:image\/\w+;base64,/, '') } });
    return { role: m.role, parts };
  });

  const userParts = [{ text: userText }];
  if (imageDataUrl) userParts.push({ inline_data: { mime_type: 'image/jpeg', data: imageDataUrl.replace(/^data:image\/\w+;base64,/, '') } });
  contents.push({ role: 'user', parts: userParts });

  const body = {
    system_instruction: { parts: [{ text: buildSystemPrompt() }] },
    contents,
    tools: [{ function_declarations: TOOL_DECLARATIONS }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
  };

  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${resp.status}`;
    if (resp.status === 400 && msg.includes('API_KEY')) throw new Error('Invalid API key');
    throw new Error(msg);
  }

  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  let replyText = ''; const toolCalls = [];

  for (const part of parts) {
    if (part.text) replyText = part.text;
    if (part.functionCall) toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args || {} });
  }

  const emotionMatch = replyText.match(/\[emotion:(\w+)\]/i);
  const emotion = emotionMatch ? emotionMatch[1].toLowerCase() : detectEmotion(toolCalls, replyText);
  replyText = replyText.replace(/\[emotion:\w+\]/gi, '').trim();

  return { reply: replyText, emotion, toolCalls };
}

const EMOTION_MAP = { dance:'excited', nod_head:'happy', wander:'focused', react_to_activity:'excited', perform_action:'excited', dance_style:'excited' };
function detectEmotion(toolCalls, reply) {
  for (const tc of toolCalls) { if (EMOTION_MAP[tc.name]) return EMOTION_MAP[tc.name]; }
  const l = reply.toLowerCase();
  if (/haha|lol|funny|joke|laugh/.test(l)) return 'happy';
  if (/danc|boogie/.test(l)) return 'excited';
  if (/sorry|oops|error|can't|cannot/.test(l)) return 'sad';
  if (/angry|mad/.test(l)) return 'angry';
  return 'neutral';
}

// ════════════════════════════════════════════════════════
// YOUTUBE & TOOL EXECUTION
// ════════════════════════════════════════════════════════
async function openYouTube(query) {
  toast(`🔍 Searching YouTube for "${query}"...`);
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&key=${YT_API_KEY}`);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      document.getElementById('ytFrame').src = `https://www.youtube.com/embed/${data.items[0].id.videoId}?autoplay=1`;
      document.getElementById('ytContainer').style.display = 'flex';
      toast('✅ Playing Video!');
    } else toast('❌ No embeddable video found.');
  } catch (error) { toast('❌ YouTube search failed.'); }
}
function closeYouTube() { document.getElementById('ytContainer').style.display = 'none'; document.getElementById('ytFrame').src = ''; }

async function executeTools(toolCalls) {
  for (const tc of toolCalls) {
    const args = tc.args || {};
    switch(tc.name) {
      case 'move_forward':   await startDirectMove('F'); await sleep((args.duration_seconds || 1)*1000); await stopDirectMove(); break;
      case 'move_backward':  await startDirectMove('B'); await sleep((args.duration_seconds || 1)*1000); await stopDirectMove(); break;
      case 'turn_left':      await startDirectMove('L'); await sleep((args.duration_seconds || 0.5)*1000); await stopDirectMove(); break;
      case 'turn_right':     await startDirectMove('R'); await sleep((args.duration_seconds || 0.5)*1000); await stopDirectMove(); break;
      case 'stop_robot':     await stopDirectMove(); break;
      case 'dance':          await doDance(); break;
      case 'nod_head':       const times = args.times || 1; for (let i = 0; i < times; i++) { await doAction('nod'); } break;
      case 'wander':         await doWander(); break;
      case 'capture_photo':  autoCapture(); break;
      case 'search_youtube': if (args.query) await openYouTube(args.query); break;
      case 'call_contact':   if (args.phone_number) window.location.href = `tel:${args.phone_number}`; break;
      case 'react_to_activity':
        showActivityOverlay(args.activity); break;
      case 'perform_action':
        const actionMap = { happy: 'H', scared: 'X', shake: '6', neck_dance: 'K', spin: 'P', reverse_nod: '7', look_left: 'A', look_right: 'C' };
        if (actionMap[args.action]) { await bleSend(actionMap[args.action]); await sleep(1000); await bleSend('E'); }
        break;
      case 'draw_shape':
        if (args.shape === 'circle') { await bleSend('P'); await sleep(1500); } 
        else if (args.shape === 'rectangle') { for (let i = 0; i < 4; i++) { await bleSend('F'); await sleep(800); await bleSend('L'); await sleep(400); } await bleSend('S'); }
        break;
      case 'dance_style':
        if (args.style === 'michael_jackson') { await bleSend('B'); await sleep(1200); await bleSend('P'); await sleep(1500); await bleSend('K'); await sleep(2000); await bleSend('6'); await sleep(1000); await bleSend('S'); }
        break;
    }
  }
}

// ════════════════════════════════════════════════════════
// CHAT FLOW
// ════════════════════════════════════════════════════════
async function sendChat() {
  const inp = document.getElementById('userInput'); const text = inp.value.trim();
  if (!text || isBusy) return;
  inp.value = ''; resetInactivity();

  let attachedImage = currentUploadedImage || null;
  currentUploadedImage = null; updateUploadPreview();

  const visionKw = ['what am i holding','look at me','what is this','see this'];
  if (!attachedImage && visionKw.some(kw => text.toLowerCase().includes(kw))) {
    attachedImage = captureSnapshot();
    if (attachedImage) { appendImageMsg('user', attachedImage); toast('📸 Auto-captured!'); }
  } else if (attachedImage) { appendImageMsg('user', attachedImage); }

  appendMsg('user', text);
  await doChat(text, attachedImage);
}

function sendSug(t) { document.getElementById('userInput').value = t; sendChat(); }

async function doChat(userText, imageDataUrl = null) {
  isBusy = true; document.getElementById('sendBtn').disabled = true;
  const typEl = showTyping();
  try {
    const { reply, emotion, toolCalls } = await callGemini(userText, imageDataUrl);
    removeTyping(typEl); appendMsg('bot', reply, toolCalls.map(t => t.name)); setEmotion(emotion); speak(reply);
    addToHistory('user', userText, imageDataUrl); addToHistory('model', reply);
    await executeTools(toolCalls);
  } catch(e) { removeTyping(typEl); appendMsg('bot', `❌ ${e.message}`, []); setEmotion('sad'); speak('Oops! Error.'); } finally { isBusy = false; document.getElementById('sendBtn').disabled = false; }
}

function addToHistory(role, text, imageBase64 = null) { chatHistory.push({ role, text, imageBase64 }); if (chatHistory.length > MAX_HISTORY) chatHistory.splice(0, chatHistory.length - MAX_HISTORY); try { sessionStorage.setItem('petro_history', JSON.stringify(chatHistory.map(m => ({...m, imageBase64: null})))); } catch {} updateMemoryPill(); }
function loadHistory() { try { const saved = sessionStorage.getItem('petro_history'); if (saved) chatHistory = JSON.parse(saved); } catch {} }
function clearChat() { chatHistory = []; try { sessionStorage.removeItem('petro_history'); } catch {} document.getElementById('messages').innerHTML = `<div class="msg bot"><div class="msg-label">petRO 🤖</div><div class="msg-bubble">Fresh start! ✨</div></div>`; toast('Chat cleared'); updateMemoryPill(); }
function updateMemoryPill() { document.getElementById('memoryPill').textContent = `Memory: ${chatHistory.length} / ${MAX_HISTORY} msgs`; }

// ════════════════════════════════════════════════════════
// CAMERA
// ════════════════════════════════════════════════════════
async function initCamera() { try { videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); document.getElementById('webcamView').srcObject = videoStream; } catch(e) {} }
function captureSnapshot() { const video = document.getElementById('webcamView'), canvas = document.getElementById('captureCanvas'); if (!video || !canvas || !videoStream) return null; const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480; ctx.drawImage(video, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', 0.85); }
function triggerFlash() { const f = document.createElement('div'); Object.assign(f.style, { position:'fixed', inset:'0', background:'#fff', zIndex:'9999', opacity:'1', transition:'opacity 0.4s ease' }); document.body.appendChild(f); setTimeout(() => { f.style.opacity = '0'; setTimeout(() => f.remove(), 400); }, 50); }
function manualCapture() { const dataUrl = captureSnapshot(); if (dataUrl) { appendImageMsg('user', dataUrl); toast('📸 Captured!'); } }
function autoCapture() { triggerFlash(); setTimeout(() => { const dataUrl = captureSnapshot(); if (dataUrl) { appendImageMsg('bot', dataUrl); doChat('Describe in detail what you see in this photo!', dataUrl); toast('📸 Snap!'); } }, 120); }
function handleFileUpload(e) { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => { currentUploadedImage = ev.target.result; updateUploadPreview(); }; reader.readAsDataURL(file); }
function clearUploadedImage() { currentUploadedImage = null; document.getElementById('fileInput').value = ''; updateUploadPreview(); }
function updateUploadPreview() { const bar = document.getElementById('uploadPreviewBar'), img = document.getElementById('previewImg'); if (currentUploadedImage) { img.src = currentUploadedImage; bar.style.display = 'flex'; } else { bar.style.display = 'none'; img.src = ''; } }
function appendImageMsg(role, dataUrl) { const c = document.getElementById('messages'), el = document.createElement('div'); el.className = `msg ${role}`; const bub = document.createElement('div'); bub.className = 'msg-bubble'; bub.style.padding = '4px'; const img = document.createElement('img'); img.src = dataUrl; img.style.cssText = 'max-width:100%;border-radius:10px;display:block;'; bub.appendChild(img); el.appendChild(bub); c.appendChild(el); c.scrollTop = c.scrollHeight; }

// ════════════════════════════════════════════════════════
// TTS, EMOJI FILTERING & VOICE PROFILES
// ════════════════════════════════════════════════════════
const synth = window.speechSynthesis;
function speak(text) {
  if (!synth) return; synth.cancel();
  const clean = text.replace(/\p{Emoji}/gu, '').replace(/\[emotion:\w+\]/gi, '').trim(); if (!clean) return;
  const utt = new SpeechSynthesisUtterance(clean);
  const theme = localStorage.getItem('petro_theme') || 'default'; let pitch = 1.0, rate = 1.05;
  if (theme === 'terminator') { pitch = 0.4; rate = 0.9; } else if (theme === 'transformer') { pitch = 0.1; rate = 0.85; } else if (theme === 'monkey') { pitch = 1.5; rate = 1.25; } else if (theme === 'dog') { pitch = 1.3; rate = 1.15; } else if (theme === 'starwars') { pitch = 1.8; rate = 1.4; }
  utt.pitch = pitch; utt.rate = rate; utt.volume = 1;
  const voices = synth.getVoices(); const pref = voices.find(v => /female|zira|samantha|karen|moira|fiona/i.test(v.name)) || voices.find(v => v.lang.startsWith('en')) || voices[0];
  if (pref) utt.voice = pref;
  utt.onstart = () => { ttsActive = true; updateTTSBtn(); animateMouth(true); }; utt.onend = () => { ttsActive = false; updateTTSBtn(); animateMouth(false); }; utt.onerror = () => { ttsActive = false; updateTTSBtn(); animateMouth(false); };
  synth.speak(utt);
}
function stopTTS() { synth?.cancel(); ttsActive = false; updateTTSBtn(); animateMouth(false); }
function updateTTSBtn() { document.getElementById('ttsBtn').className = ttsActive ? 'icon-btn speaking' : 'icon-btn'; }
function animateMouth(talking) { if (mouthTalkAnim) { cancelAnimationFrame(mouthTalkAnim); mouthTalkAnim = null; } if (!talking) { applyMouthForEmotion(currentEmotion); return; } let t = 0; const em = emotions[currentEmotion] || emotions.neutral; (function frame() { t += 0.18; setMouthPath(em.mouthType, (em.mouthOpen || 0) + Math.abs(Math.sin(t)) * 12); mouthTalkAnim = requestAnimationFrame(frame); })(); }

// ════════════════════════════════════════════════════════
// EXPRESSIVE FACE ENGINE
// ════════════════════════════════════════════════════════
const eyeEls = {}; let eyeOff = {lx:0,ly:0,rx:0,ry:0}; let eyeTgt = {lx:0,ly:0,rx:0,ry:0};
function initEyes() { ['lIris','lPupil','lLidTop','lLidBot','lHL1','lHL2','lRim','lBrow', 'rIris','rPupil','rLidTop','rLidBot','rHL1','rHL2','rRim','rBrow'].forEach(k => eyeEls[k] = document.getElementById(k)); runEyeLoop(); scheduleBlink(); scheduleEyeMove(); }
function runEyeLoop() { (function loop() { const s = 0.12; eyeOff.lx += (eyeTgt.lx - eyeOff.lx)*s; eyeOff.ly += (eyeTgt.ly - eyeOff.ly)*s; eyeOff.rx += (eyeTgt.rx - eyeOff.rx)*s; eyeOff.ry += (eyeTgt.ry - eyeOff.ry)*s; setEyePos('l', 65+eyeOff.lx, 88+eyeOff.ly); setEyePos('r',235+eyeOff.rx, 88+eyeOff.ry); requestAnimationFrame(loop); })(); }
function scheduleEyeMove() { if (!isSleeping) { if (Math.random() > 0.4) { const angle = Math.random() * Math.PI * 2; const radius = Math.random() * 12; eyeTgt.lx = Math.cos(angle) * radius; eyeTgt.ly = Math.sin(angle) * radius; eyeTgt.rx = eyeTgt.lx; eyeTgt.ry = eyeTgt.ly; } else { eyeTgt.lx = 0; eyeTgt.ly = 0; eyeTgt.rx = 0; eyeTgt.ry = 0; } } else { eyeTgt.lx = 0; eyeTgt.ly = 0; eyeTgt.rx = 0; eyeTgt.ry = 0; } setTimeout(scheduleEyeMove, 1000 + Math.random() * 2500); }
function setEyePos(s, x, y) { eyeEls[`${s}Iris`].setAttribute('cx', x); eyeEls[`${s}Iris`].setAttribute('cy', y); eyeEls[`${s}Pupil`].setAttribute('cx', x); eyeEls[`${s}Pupil`].setAttribute('cy', y); eyeEls[`${s}HL1`].setAttribute('cx', x-11); eyeEls[`${s}HL1`].setAttribute('cy', y-13); eyeEls[`${s}HL2`].setAttribute('cx', x+11); eyeEls[`${s}HL2`].setAttribute('cy', y-9); }
function scheduleBlink() { blinkTimer = setTimeout(() => { doBlink(); scheduleBlink(); }, isSleeping ? 9000 : 2000 + Math.random()*4000); }

const emotions = {
  neutral:  { irisR:42, pupilR:22, color:'var(--theme-color)', lidTopY:-65, lidBotY:200, browW:0, browSlant:0,  mouthType:'smile',  mouthOpen:0,  tears:false },
  happy:    { irisR:48, pupilR:26, color:'#22d3a0', lidTopY:-65, lidBotY:142, browW:0, browSlant:0,  mouthType:'smile',  mouthOpen:12, tears:false },
  excited:  { irisR:52, pupilR:30, color:'#ffd23f', lidTopY:-65, lidBotY:200, browW:0, browSlant:-6, mouthType:'laugh',  mouthOpen:20, tears:true  },
  sad:      { irisR:30, pupilR:15, color:'#6b8db5', lidTopY:-18, lidBotY:200, browW:8, browSlant:8,  mouthType:'frown',  mouthOpen:0,  tears:true  },
  angry:    { irisR:36, pupilR:17, color:'#ff5f6d', lidTopY:-24, lidBotY:200, browW:9, browSlant:-9, mouthType:'flat',   mouthOpen:0,  tears:false },
  focused:  { irisR:38, pupilR:18, color:'#a855f7', lidTopY:-65, lidBotY:200, browW:0, browSlant:0,  mouthType:'small',  mouthOpen:0,  tears:false },
  dizzy:    { irisR:20, pupilR:8,  color:'#ff9800', lidTopY:-65, lidBotY:200, browW:4, browSlant:5,  mouthType:'wiggle', mouthOpen:0,  tears:false },
  afraid:   { irisR:55, pupilR:10, color:'#ddeeff', lidTopY:-65, lidBotY:200, browW:5, browSlant:8,  mouthType:'small',  mouthOpen:10, tears:false },
  sleeping: { irisR:7,  pupilR:4,  color:'#3d5470', lidTopY:45,  lidBotY:65,  browW:0, browSlant:0,  mouthType:'sleep',  mouthOpen:0,  tears:false },
};

function doBlink() { const em = emotions[currentEmotion] || emotions.neutral; lidAnim(eyeEls.lLidTop, em.lidTopY, 30, 200); lidAnim(eyeEls.rLidTop, em.lidTopY, 30, 200); }
function lidAnim(el, from, to, back) { const steps = [{y:to,ms:70},{y:back,ms:50},{y:from,ms:65}]; let i = 0; (function nx() { if (i >= steps.length) return; const s = steps[i++]; el.setAttribute('y', s.y); setTimeout(nx, s.ms); })(); }

function setEmotion(name, force = false) {
  if (isSleeping && !force) return;
  const em = emotions[name] || emotions.neutral; currentEmotion = name;
  clearTimeout(emotionResetTimer); if (name !== 'neutral' && name !== 'sleeping') emotionResetTimer = setTimeout(() => setEmotion('neutral'), 5000);
  for (const s of ['l','r']) { eyeEls[`${s}Iris`].setAttribute('rx', em.irisR); eyeEls[`${s}Iris`].setAttribute('ry', em.irisR); eyeEls[`${s}Pupil`].setAttribute('rx', em.pupilR); eyeEls[`${s}Pupil`].setAttribute('ry', em.pupilR); eyeEls[`${s}Iris`].style.fill = (name==='neutral') ? 'url(#ig1)' : em.color; eyeEls[`${s}LidTop`].setAttribute('y', em.lidTopY); eyeEls[`${s}LidBot`].setAttribute('y', em.lidBotY); eyeEls[`${s}Rim`].setAttribute('stroke', em.color); }
  eyeEls.lBrow.setAttribute('stroke-width', em.browW); eyeEls.rBrow.setAttribute('stroke-width', em.browW); eyeEls.lBrow.setAttribute('stroke', em.color); eyeEls.rBrow.setAttribute('stroke', em.color);
  if (em.browSlant !== 0) { eyeEls.lBrow.setAttribute('y1', 35 - em.browSlant); eyeEls.lBrow.setAttribute('y2', 35 + em.browSlant); eyeEls.rBrow.setAttribute('y1', 35 + em.browSlant); eyeEls.rBrow.setAttribute('y2', 35 - em.browSlant); } else { eyeEls.lBrow.setAttribute('y1', 35); eyeEls.lBrow.setAttribute('y2', 35); eyeEls.rBrow.setAttribute('y1', 35); eyeEls.rBrow.setAttribute('y2', 35); }
  document.getElementById('tearGroup').style.opacity = em.tears ? '1' : '0'; if (!ttsActive) applyMouthForEmotion(name);
}

function applyMouthForEmotion(name) { const em = emotions[name] || emotions.neutral; setMouthPath(em.mouthType, em.mouthOpen); document.getElementById('mouthRim').setAttribute('stroke', em.color); }
function setMouthPath(type, open = 0) {
  const mp = document.getElementById('mouthPath'); let d = '';
  switch(type) {
    case 'smile':  d = `M 105 165 Q 150 ${178+open} 195 165`; break;
    case 'laugh':  d = `M 105 162 Q 150 ${185+open} 195 162`; break;
    case 'frown':  d = `M 105 174 Q 150 ${162-open} 195 174`; break;
    case 'flat':   d = `M 110 169 L 190 169`; break;
    case 'small':  d = `M 125 168 Q 150 ${174+open} 175 168`; break;
    case 'sleep':  d = `M 125 168 Q 150 168 175 168`; break;
    case 'wiggle': d = `M 110 169 Q 130 159 150 169 T 190 169`; break;
    default:       d = `M 105 169 Q 150 ${178+open} 195 169`;
  }
  mp.setAttribute('d', d); if (type === 'laugh') { mp.setAttribute('fill','rgba(0,0,0,0.5)'); mp.setAttribute('stroke-width','2.5'); } else { mp.setAttribute('fill','none'); mp.setAttribute('stroke-width','3.5'); }
}

// ════════════════════════════════════════════════════════
// SLEEP / WAKE / IDLE
// ════════════════════════════════════════════════════════
function goToSleep() { if(isSleeping)return; isSleeping=true; setEmotion('sleeping',true); stopTTS(); startZZZ(); if(bleConnected) bleSend('S'); }
function wakeUp() { if(!isSleeping)return; isSleeping=false; stopZZZ(); setEmotion('neutral',true); resetInactivity(); }
function startZZZ() { const g = document.getElementById('sleepZZZ'), z1 = document.getElementById('z1'), z2 = document.getElementById('z2'), z3 = document.getElementById('z3'); g.style.opacity = '1'; let t = 0; (function f() { t+=0.03; const b=Math.sin(t)*0.3+0.7; z1.setAttribute('opacity',b); z2.setAttribute('opacity',b*0.7); z3.setAttribute('opacity',b*0.45); z1.setAttribute('y',40-Math.sin(t*0.7)*7); z2.setAttribute('y',24-Math.sin(t*0.7+.5)*7); z3.setAttribute('y',6-Math.sin(t*0.7+1)*7); zzzAnim=requestAnimationFrame(f); })(); }
function stopZZZ() { if(zzzAnim)cancelAnimationFrame(zzzAnim); document.getElementById('sleepZZZ').style.opacity = '0'; }

function resetInactivity() { 
  if(isSleeping) wakeUp(); 
  clearTimeout(inactTimer); clearTimeout(fidgetTimer); 
  inactTimer = setTimeout(goToSleep, SLEEP_MS); 
  fidgetTimer = setTimeout(doFidget, 60000); // Trigger a random move after 1 minute idle
}

async function doFidget() {
  if(!bleConnected || isSleeping || isBusy) return;
  const fidgetMoves = ['A', 'C', 'E', 'V', 'T', 'U']; // Neck Left, Right, Base, Tilt Mid, Max, Base
  const randomMove = fidgetMoves[Math.floor(Math.random() * fidgetMoves.length)];
  await bleSend(randomMove);
  fidgetTimer = setTimeout(doFidget, 30000 + Math.random() * 30000); 
}

['click','keydown','touchstart'].forEach(e => document.addEventListener(e, resetInactivity, {passive:true}));

function appendMsg(role, text, actions = []) { const c = document.getElementById('messages'), el = document.createElement('div'); el.className = `msg ${role}`; const lbl = document.createElement('div'); lbl.className = 'msg-label'; lbl.textContent = role === 'user' ? 'You' : 'petRO 🤖'; const bub = document.createElement('div'); bub.className = 'msg-bubble'; bub.textContent = text; el.append(lbl, bub); if (actions?.length) { const chip = document.createElement('div'); chip.className = 'actions-chip'; chip.textContent = '⚡ ' + actions.join(' · '); el.append(chip); } c.append(el); c.scrollTop = c.scrollHeight; }
function showTyping() { const c=document.getElementById('messages'),el=document.createElement('div'); el.className='msg bot'; el.innerHTML=`<div class="msg-label">petRO 🤖</div><div class="typing-wrap"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`; c.append(el); c.scrollTop=c.scrollHeight; return el; }
function removeTyping(el) { el?.remove(); }
function toast(msg) { const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'), 3400); }

// ... (Mic and Wake word listening remains unchanged) ...
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function toggleAlwaysOnMic() { if(!SR){toast('⚠️ Speech API not supported');return;} alwaysOnMic=!alwaysOnMic; if(alwaysOnMic){startBgListen(); updateMicBadge('wake');} else{stopAllRecog(); updateMicBadge('off');} }
function updateMicBadge(state) { const b=document.getElementById('micBadge'); if(state==='off'){b.className='badge mic-off'; b.textContent='🎤 OFF';} if(state==='wake'){b.className='badge mic-wake'; b.textContent='👂 WAKE';} if(state==='cmd'){b.className='badge mic-on'; b.textContent='🔴 REC';} }
function stopAllRecog() { try{bgRecog?.abort();}catch{} try{cmdRecog?.abort();}catch{} bgRecog=null; cmdRecog=null; micState='off'; setListenRipples(false); document.getElementById('wakeOverlay').classList.remove('active'); }
function startBgListen() { if(!alwaysOnMic || micState==='cmd') return; try{bgRecog?.abort();}catch{} bgRecog = new SR(); bgRecog.continuous=true; bgRecog.interimResults=true; bgRecog.lang='en-US'; micState='wake'; bgRecog.onresult = e => { if(micState!=='wake')return; for(let i=e.resultIndex; i<e.results.length; i++){ const t=e.results[i][0].transcript.toLowerCase(); if(WAKE_WORDS.some(w=>t.includes(w))) wakeWordDetected(); } }; bgRecog.onerror = e => { if(e.error!=='aborted') restartBg(); }; bgRecog.onend = () => { if(alwaysOnMic && micState==='wake') setTimeout(restartBg,300); }; try{bgRecog.start();}catch{} }
function restartBg() { if(alwaysOnMic && micState==='wake') startBgListen(); }
function wakeWordDetected() { if(micState==='cmd')return; try{bgRecog?.abort();}catch{} resetInactivity(); showWakeOverlay(); listenForCommand(); }
function listenForCommand() { micState='cmd'; updateMicBadge('cmd'); setListenRipples(true); cmdRecog = new SR(); cmdRecog.continuous=false; cmdRecog.interimResults=true; const sub = document.getElementById('wakeSub'); sub.textContent = 'Speak your command…'; cmdRecog.onresult = e => { const last = e.results[e.results.length-1]; const t = last[0].transcript; if(last.isFinal){ sub.textContent=`"${t}"`; hideWakeOverlay(); micState='wake'; document.getElementById('userInput').value=t; appendMsg('user',t); doChat(t); setTimeout(startBgListen,800); } else { sub.textContent=t+'…'; } }; cmdRecog.onerror = () => { hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,400); }; cmdRecog.onend = () => { if(micState==='cmd'){hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,400);} }; try{cmdRecog.start();}catch{hideWakeOverlay(); micState='wake'; startBgListen();} }
function cancelWake() { try{cmdRecog?.abort();}catch{} hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,300); }
function showWakeOverlay() { document.getElementById('wakeOverlay').classList.add('active'); updateMicBadge('cmd'); }
function hideWakeOverlay() { document.getElementById('wakeOverlay').classList.remove('active'); setListenRipples(false); updateMicBadge('wake'); }
function setListenRipples(on) { document.getElementById('rippleGroup').style.opacity = on?'1':'0'; if(on) rippleLoop(); }
function rippleLoop() { const r1=document.getElementById('rp1'), r2=document.getElementById('rp2'); let t=0; (function f(){ t+=0.04; const s1=5+Math.sin(t)*10+10, s2=5+Math.sin(t+Math.PI)*10+10; r1.setAttribute('r',s1); r1.setAttribute('opacity',Math.max(0,0.7-s1/30)); r2.setAttribute('r',s2); r2.setAttribute('opacity',Math.max(0,0.5-s2/35)); if(document.getElementById('rippleGroup').style.opacity==='1') requestAnimationFrame(f); })(); }

window.addEventListener('DOMContentLoaded', () => { initEyes(); resetInactivity(); initCamera(); loadHistory(); loadPersonalization(); updateKeyBadge(); updateMemoryPill(); applyMouthForEmotion('neutral'); if (synth) { synth.getVoices(); synth.addEventListener('voiceschanged', () => synth.getVoices()); } });
