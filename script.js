'use strict';

// ════════════════════════════════════════════════════════
// CONFIG & THEMES
// ════════════════════════════════════════════════════════
const WAKE_WORDS  = ['ok petro','okay petro','hey petro'];
const SLEEP_MS    = 5 * 60 * 1000;
const MAX_HISTORY = 50;
const GEMINI_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// The YouTube Data API Key you provided
const YT_API_KEY = 'AIzaSyC6Z2NDf7sy6oz35p5ZZfB8yYNVz5sJZZU';

const BLE_SERVICE  = '00001234-0000-1000-8000-00805f9b34fb';
const BLE_CMD_CHAR = '00005678-0000-1000-8000-00805f9b34fb';
const BLE_HB_CHAR  = '00005679-0000-1000-8000-00805f9b34fb';
const BLE_NAME     = 'petRO';

// Theme configurations
const THEMES = {
  default: {
    color: '#3b9eff', bg: '#090d18', surface: '#101623', card: '#141e30',
    prompt: "You are petRO, a cute and playful robot with wheels and a servo head. Be playful, warm, and fun. Keep replies SHORT."
  },
  dog: {
    color: '#ff9800', bg: '#1a1005', surface: '#2b1b0a', card: '#3d2610',
    prompt: "You are an energetic and loyal robot dog. Bark playfully in text (e.g. 'Woof!'). Act like a happy puppy. Keep replies SHORT."
  },
  terminator: {
    color: '#ff3333', bg: '#0a0000', surface: '#1a0000', card: '#2a0505',
    prompt: "You are a calculating cyborg T-800. Speak concisely. Use robotic/movie references like 'Affirmative'. Keep replies SHORT."
  },
  monkey: {
    color: '#8bc34a', bg: '#0a1205', surface: '#13240a', card: '#1c360e',
    prompt: "You are a cheeky, energetic robot monkey. Make occasional monkey sounds in text. Be mischievous. Keep replies SHORT."
  },
  starwars: {
    color: '#00e5ff', bg: '#000814', surface: '#00122e', card: '#001c47',
    prompt: "You are a helpful astromech droid. Make beep-boop sounds in text. You are loyal and courageous. Keep replies SHORT."
  },
  transformer: {
    color: '#f44336', bg: '#0d1017', surface: '#181d29', card: '#222a3b',
    prompt: "You are Optimus Prime, a noble Autobot leader. Speak with deep authority, heroism, and respect. Keep replies SHORT."
  }
};

// ════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════
let bleDevice    = null;
let bleCmdChar   = null;
let bleConnected = false;
let isBusy       = false;
let isMoving     = false;
let isVideoPlaying = false; // NEW: Track video state
let videoBobTimer = null;   // NEW: Video slow dance timer

let currentEmotion = 'neutral';
let emotionResetTimer = null; 
let isSleeping   = false;
let micState = 'off', alwaysOnMic = false;
let bgRecog = null, cmdRecog = null;
let inactTimer = null, zzzAnim = null, blinkTimer = null;
let videoStream = null, currentUploadedImage = null;
let ttsActive = false;
let mouthTalkAnim = null;
let toastTimer = null;
let chatHistory = [];
let motionEnabled = false;
let idleWanderTimer = null;

// ════════════════════════════════════════════════════════
// FULLSCREEN LOGIC
// ════════════════════════════════════════════════════════
async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    try { await document.documentElement.requestFullscreen(); if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(e => console.log('Orientation lock not supported')); } catch(e) { toast('⚠️ Fullscreen not supported'); }
  } else {
    try { await document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch(e) {}
  }
}

// ════════════════════════════════════════════════════════
// API KEY & PERSONALIZATION
// ════════════════════════════════════════════════════════
function getApiKey() { return localStorage.getItem('petro_gemini_key') || ''; }
function saveApiKey() {
  const v = document.getElementById('apiKeyInput').value.trim();
  if (!v) { toast('⚠️ Please paste a key first'); return; }
  localStorage.setItem('petro_gemini_key', v);
  updateKeyBadge(); toast('✅ Key saved!'); closeSettings();
}
function clearApiKey() {
  localStorage.removeItem('petro_gemini_key');
  document.getElementById('apiKeyInput').value = '';
  updateKeyBadge(); toast('🗑 Key removed');
}
function updateKeyBadge() {
  const k = getApiKey();
  const badge = document.getElementById('keyBadge');
  const status = document.getElementById('keyStatus');
  if (k) { badge.className = 'badge key-set'; badge.textContent = '🔑 KEY ✓'; status.className = 'key-status ok'; status.textContent = `Key saved: ${k.slice(0,8)}…`; } 
  else { badge.className = 'badge key-missing'; badge.textContent = '🔑 KEY'; status.className = 'key-status bad'; status.textContent = 'No key saved'; }
}
function toggleKeyVisibility() {
  const inp = document.getElementById('apiKeyInput');
  const btn = document.getElementById('eyeBtn');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

function loadPersonalization() {
  document.getElementById('userNameInput').value = localStorage.getItem('petro_user_name') || '';
  document.getElementById('themeSelect').value = localStorage.getItem('petro_theme') || 'default';
  applyTheme();
}
function savePersonalization() {
  localStorage.setItem('petro_user_name', document.getElementById('userNameInput').value.trim());
  localStorage.setItem('petro_theme', document.getElementById('themeSelect').value);
  applyTheme(); toast('✅ Identity & Theme Saved!');
}
function applyTheme() {
  const tId = document.getElementById('themeSelect').value || 'default';
  const t = THEMES[tId];
  const root = document.documentElement;
  
  root.style.setProperty('--theme-color', t.color);
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--surface', t.surface);
  root.style.setProperty('--card', t.card);
  document.getElementById('stop1-2').setAttribute('stop-color', t.color);
  document.getElementById('stop2-2').setAttribute('stop-color', t.color);
  document.getElementById('lGlow').setAttribute('stroke', t.color);
  document.getElementById('rGlow').setAttribute('stroke', t.color);

  const addons = ['dog', 'terminator', 'monkey', 'starwars', 'transformer'];
  addons.forEach(addon => { const el = document.getElementById('theme-' + addon); if (el) el.style.opacity = (tId === addon) ? '1' : '0'; });

  const mouthGroup = document.getElementById('mouthGroup'), mouthRim = document.getElementById('mouthRim');
  if (tId === 'transformer') { mouthGroup.style.opacity = '0'; mouthRim.style.opacity = '0'; } 
  else { mouthGroup.style.opacity = '1'; mouthRim.style.opacity = '1'; }
  if (currentEmotion === 'neutral') setEmotion('neutral', true);
}

function openSettings() { const k = getApiKey(); if (k) document.getElementById('apiKeyInput').value = k; document.getElementById('settingsModal').classList.add('open'); updateKeyBadge(); updateBleInfoBox(); updateMemoryPill(); }
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }
document.getElementById('settingsModal').addEventListener('click', function(e) { if (e.target === this) closeSettings(); });

// ════════════════════════════════════════════════════════
// WEB BLUETOOTH
// ════════════════════════════════════════════════════════
async function toggleBLE() {
  if (bleConnected) { disconnectBLE(); return; }
  if (!navigator.bluetooth) { toast('❌ Web Bluetooth not supported.'); return; }
  setBLE(null); toast('🔍 Scanning…');

  try { bleDevice = await navigator.bluetooth.requestDevice({ filters: [{ name: BLE_NAME }], optionalServices: [BLE_SERVICE] }); } 
  catch(e1) {
    if (e1.name === 'AbortError') { setBLE(false); return; }
    toast('⚠️ Name scan failed. Showing all devices…');
    try { bleDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [BLE_SERVICE] }); } 
    catch(e2) { setBLE(false); toast('❌ No BLE devices found.'); return; }
  }

  bleDevice.addEventListener('gattserverdisconnected', onBleDisconnect);
  toast(`🔗 Connecting to ${bleDevice.name}…`);
  try {
    const server  = await bleDevice.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE);
    bleCmdChar    = await service.getCharacteristic(BLE_CMD_CHAR);
    setBLE(true); toast(`✅ Connected!`);
    updateBleInfoBox(); resetInactivity(); startIdleWander();
  } catch(e) { setBLE(false); bleDevice = null; toast('❌ Connection failed.'); }
}

function disconnectBLE() { try { bleDevice?.gatt?.disconnect(); } catch {} bleDevice = null; bleCmdChar = null; setBLE(false); toast('Disconnected'); updateBleInfoBox(); }
function onBleDisconnect() { if (!bleConnected) return; setBLE(false); toast('⚠️ petRO disconnected.'); bleCmdChar = null; updateBleInfoBox(); }
function setBLE(s) { const b = document.getElementById('bleBtn'); if (s === null) { b.className='badge ble-spin'; b.textContent='⟳ BLE…'; } else if (s) { b.className='badge ble-on'; b.textContent='🟢 BLE'; } else { b.className='badge ble-off'; b.textContent='⚫ BLE'; } bleConnected = !!s; }
function updateBleInfoBox() { const el = document.getElementById('bleInfoBox'); if (!el) return; if (bleConnected && bleDevice) el.innerHTML = `Status: <span style="color:var(--green)">Connected ✓</span>`; else el.innerHTML = `Status: <span style="color:var(--red)">Not connected</span>`; }

async function bleSend(cmd) {
  if (!bleCmdChar) return;
  if (!bleDevice?.gatt?.connected) { try { const server = await bleDevice.gatt.connect(); const service = await server.getPrimaryService(BLE_SERVICE); bleCmdChar = await service.getCharacteristic(BLE_CMD_CHAR); setBLE(true); } catch(e) { setBLE(false); return; } }
  try { await bleCmdChar.writeValueWithoutResponse(new TextEncoder().encode(cmd)); } catch(e) { setBLE(false); bleCmdChar = null; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════
// DIRECT MOVE (Continuous D-pad + Actions)
// ════════════════════════════════════════════════════════
async function startDirectMove(cmd) { if (!bleConnected) { toast('⚠️ Connect BLE first!'); return; } resetInactivity(); isMoving = true; await bleSend(cmd); }
async function stopDirectMove() { if (!isMoving || !bleConnected) return; isMoving = false; await bleSend('S'); }

async function doAction(action) {
  if (!bleConnected) { toast('⚠️ Connect BLE first!'); return; }
  resetInactivity();
  switch(action) {
    case 'nod':      await bleSend('5'); break; 
    case 'dance':    await executeTools([{name:'dance', args:{}}]); break; 
    case 'wander':   await bleSend('W'); break; 
  }
}

// ════════════════════════════════════════════════════════
// GYROSCOPE / ACCELEROMETER - WITH SELF-AWARENESS FIX
// ════════════════════════════════════════════════════════
function enableMotionSensors() {
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission().then(response => { if (response == 'granted') { motionEnabled = true; bindSensors(); toast('✅ Motion Synced'); document.getElementById('gyroBtn').style.display='none'; } else toast('❌ Permission denied'); }).catch(console.error);
  } else { motionEnabled = true; bindSensors(); toast('✅ Motion Synced'); document.getElementById('gyroBtn').style.display='none'; }
}

let lastAccel = 0;
function bindSensors() {
  window.addEventListener('devicemotion', (e) => {
    // FIX: Ignore motion data if robot is actively doing something or playing video
    if(isSleeping || !motionEnabled || isMoving || isBusy || isVideoPlaying) return;
    
    let acc = e.accelerationIncludingGravity; if(!acc) return;
    let total = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
    if(Math.abs(total - lastAccel) > 16) { setEmotion('dizzy'); resetInactivity(); } lastAccel = total;
  });
  window.addEventListener('deviceorientation', (e) => {
    // FIX: Ignore orientation data if robot is actively doing something
    if(isSleeping || !motionEnabled || isMoving || isBusy || isVideoPlaying) return;
    
    if(Math.abs(e.beta) > 60 || Math.abs(e.gamma) > 60) { if(currentEmotion !== 'afraid') setEmotion('afraid'); resetInactivity(); }
  });
}

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
  move_forward(duration_seconds)  → drive forward for N seconds
  move_backward(duration_seconds) → reverse for N seconds
  turn_left(duration_seconds)     → spin wheels left for N seconds
  turn_right(duration_seconds)    → spin wheels right for N seconds
  look_left()                     → turn head/camera left (servo only, no wheels)
  look_right()                    → turn head/camera right (servo only, no wheels)
  look_center()                   → return head to center
  stop_robot()                    → stop movement
  dance(style)                    → dance routine (style: 'michael_jackson', 'freestyle', etc.)
  draw_shape(shape)               → Drive the robot in a specific shape (circle, rectangle)
  perform_emotion(emotion)        → Triggers physical kinetics. Enums: ['happy', 'sad', 'angry', 'curious', 'scared', 'focused', 'nod']
  show_prop(prop)                 → Displays UI props. Enums: ['food', 'book', 'dumbbell']. CALL THIS IF user says they are eating, studying, or working out. Or if you see them doing it in an image!
  search_youtube(query)           → search YouTube
  call_contact(phone_number)      → open dialer to call number (ask for number if unknown)

VISION & PROPS: Always describe image contents enthusiastically. If the user attaches an image of food/pizza/eating, call [show_prop('food')]. If they are reading, call [show_prop('book')]. If they are lifting/working out, call [show_prop('dumbbell')].
EMOTION HINTS: append ONE tag to text response: [emotion:neutral], [emotion:happy], [emotion:excited], [emotion:sad], [emotion:angry], [emotion:focused]`;
  return p;
}

const TOOL_DECLARATIONS = [
  { name:'move_forward',  description:'Drive forward.', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER', description: 'Seconds to move'} }} },
  { name:'move_backward', description:'Reverse.', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER', description: 'Seconds to move'} }} },
  { name:'turn_left',     description:'Spin wheels left.', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER', description: 'Seconds to move'} }} },
  { name:'turn_right',    description:'Spin wheels right.', parameters:{type:'OBJECT',properties:{ duration_seconds: {type: 'NUMBER', description: 'Seconds to move'} }} },
  { name:'look_left',     description:'Turn ONLY the head/camera left using the neck servo. Does not move the wheels.', parameters:{type:'OBJECT',properties:{}} },
  { name:'look_right',    description:'Turn ONLY the head/camera right using the neck servo. Does not move the wheels.', parameters:{type:'OBJECT',properties:{}} },
  { name:'look_center',   description:'Return the head/camera to the center forward position.', parameters:{type:'OBJECT',properties:{}} },
  { name:'stop_robot',    description:'Stop immediately', parameters:{type:'OBJECT',properties:{}} },
  { name:'dance',         description:'Dance routine', parameters:{type:'OBJECT',properties:{ style: {type: 'STRING', description: 'e.g., michael_jackson'} }} },
  { name:'draw_shape',    description:'Drive in a specific shape.', parameters:{type:'OBJECT',properties:{ shape: {type: 'STRING', enum: ['circle', 'rectangle']} }} },
  { name:'perform_emotion',description:'Trigger physical hardware kinetics.', parameters:{type:'OBJECT',properties:{ emotion: {type: 'STRING', enum: ['happy', 'sad', 'angry', 'curious', 'scared', 'focused', 'nod']} }} },
  { name:'show_prop',     description:'Show virtual UI prop on the robot face.', parameters:{type:'OBJECT',properties:{ prop: {type: 'STRING', enum: ['food', 'book', 'dumbbell']} }} },
  { name:'capture_photo', description:'Snap photo', parameters:{type:'OBJECT',properties:{}} },
  { name:'search_youtube',description:'Search YouTube and play in app', parameters:{type:'OBJECT',properties:{query:{type:'STRING',description:'Query'}},required:['query']} },
  { name:'call_contact',  description:'Initiate a phone call to a specified number.', parameters:{type:'OBJECT',properties:{ phone_number: {type: 'STRING', description: 'The phone number to call'} }, required:['phone_number']} }
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

  const body = { system_instruction: { parts: [{ text: buildSystemPrompt() }] }, contents, tools: [{ function_declarations: TOOL_DECLARATIONS }], generationConfig: { temperature: 0.7, maxOutputTokens: 512 } };
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

const EMOTION_MAP = { dance:'excited', nod_head:'happy', wander:'focused', move_forward:'focused', move_backward:'focused', turn_left:'focused', turn_right:'focused', stop_robot:'neutral', capture_photo:'excited', search_youtube:'focused' };
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
// YOUTUBE IFRAME OVERLAY - WITH MIC & SLOW DANCE FIX
// ════════════════════════════════════════════════════════
async function openYouTube(query) {
  toast(`🔍 Searching YouTube for "${query}"...`);
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&type=video&key=${YT_API_KEY}`);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const vid = data.items[0].id.videoId;
      const ytContainer = document.getElementById('ytContainer');
      const ytFrame = document.getElementById('ytFrame');
      ytFrame.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1&modestbranding=1&rel=0`;
      ytContainer.style.display = 'flex';
      toast('✅ Playing Video!');
      
      // FIX: Suspend Mic & Start Slow Bobbing
      isVideoPlaying = true;
      if (alwaysOnMic) stopAllRecog();
      startVideoBob();

    } else { toast('❌ No video found.'); }
  } catch (error) { toast('❌ YouTube search failed.'); console.error(error); closeYouTube(); }
}

function closeYouTube() {
  document.getElementById('ytContainer').style.display = 'none';
  document.getElementById('ytFrame').src = 'about:blank';

  // FIX: Restore Mic & Stop Slow Bobbing
  isVideoPlaying = false;
  clearTimeout(videoBobTimer);
  if (bleConnected) bleSend('E'); // Recenter head
  if (alwaysOnMic) startBgListen(); // Turn mic back on
}

function startVideoBob() {
  clearTimeout(videoBobTimer);
  if (!isVideoPlaying || !bleConnected || isMoving || isBusy) return;

  // Choose a gentle neck movement
  const gentleMoves = ['A', 'C', 'V', 'U', 'E'];
  const move = gentleMoves[Math.floor(Math.random() * gentleMoves.length)];
  bleSend(move);

  // Repeat slowly every 2.5 to 4.5 seconds
  videoBobTimer = setTimeout(startVideoBob, 2500 + Math.random() * 2000);
}

// ════════════════════════════════════════════════════════
// TOOL EXECUTION & NEW CAPABILITIES
// ════════════════════════════════════════════════════════
async function executeTools(toolCalls) {
  for (const tc of toolCalls) {
    const args = tc.args || {};
    isMoving = true; // Block sensors while executing tools
    switch(tc.name) {
      case 'move_forward':  await startDirectMove('F'); await sleep((args.duration_seconds || 1)*1000); await stopDirectMove(); await sleep(100); break;
      case 'move_backward': await startDirectMove('B'); await sleep((args.duration_seconds || 1)*1000); await stopDirectMove(); await sleep(100); break;
      case 'turn_left':     await startDirectMove('L'); await sleep((args.duration_seconds || 0.5)*1000); await stopDirectMove(); await sleep(100); break;
      case 'turn_right':    await startDirectMove('R'); await sleep((args.duration_seconds || 0.5)*1000); await stopDirectMove(); await sleep(100); break;
      case 'look_left':     await bleSend('A'); break;
      case 'look_right':    await bleSend('C'); break;
      case 'look_center':   await bleSend('E'); break;
      case 'stop_robot':    await stopDirectMove(); break;
      case 'dance':         await handleDance(args.style); break;
      case 'draw_shape':    await drawShape(args.shape); break;
      case 'perform_emotion': 
        const ep = {happy:'H', sad:'O', angry:'G', curious:'X', scared:'W', focused:'N', nod:'5'};
        await bleSend(ep[args.emotion] || 'H');
        break;
      case 'show_prop':     triggerProp(args.prop); break;
      case 'capture_photo': autoCapture(); break;
      case 'search_youtube':if (args.query) await openYouTube(args.query); break;
      case 'call_contact':  if (args.phone_number) { toast(`📞 Calling ${args.phone_number}...`); window.location.href = `tel:${args.phone_number}`; } break;
    }
    isMoving = false;
  }
}

async function handleDance(style) {
  const lStyle = (style || '').toLowerCase();
  toast('💃 Dancing: ' + (style ? style : 'Freestyle')); 
  setEmotion('excited');
  
  if (lStyle.includes('michael') || lStyle.includes('jackson')) {
    for(let i=0; i<3; i++) { await bleSend('B'); await sleep(800); await bleSend('S'); await sleep(200); }
    await bleSend('A'); await sleep(300); await bleSend('C'); await sleep(300); await bleSend('E'); await sleep(200);
    await bleSend('L'); await sleep(800); await bleSend('S');
  } else {
    await bleSend('D');
  }
}

async function drawShape(shape) {
  toast(`🖌️ Drawing ${shape}`); setEmotion('focused');
  if (shape === 'circle') {
    await bleSend('L'); await sleep(4000); await bleSend('S');
  } else if (shape === 'rectangle') {
    for(let i=0; i<4; i++) {
      await bleSend('F'); await sleep(1200); await bleSend('S'); await sleep(200);
      await bleSend('R'); await sleep(500); await bleSend('S'); await sleep(200);
    }
  }
}

function triggerProp(prop) {
  const props = ['food', 'book', 'dumbbell'];
  props.forEach(p => {
    const el = document.getElementById('prop-' + p);
    if (el) {
      if (p === prop) {
        el.style.opacity = '1'; el.style.transform = 'scale(1.2) translateY(-10px)';
        setTimeout(() => { el.style.transform = 'scale(1) translateY(0)'; }, 300);
      } else {
        el.style.opacity = '0';
      }
    }
  });
  
  setTimeout(() => { props.forEach(p => { const el = document.getElementById('prop-' + p); if(el) el.style.opacity = '0'; }); }, 6000);
}

// ════════════════════════════════════════════════════════
// CHAT FLOW
// ════════════════════════════════════════════════════════
async function sendChat() {
  const inp = document.getElementById('userInput'); const text = inp.value.trim();
  if (!text || isBusy) return; inp.value = ''; resetInactivity();

  let attachedImage = currentUploadedImage || null; currentUploadedImage = null; updateUploadPreview();

  const visionKw = ['what am i holding','look at me','what is this','see this'];
  if (!attachedImage && visionKw.some(kw => text.toLowerCase().includes(kw))) { attachedImage = captureSnapshot(); if (attachedImage) { appendImageMsg('user', attachedImage); toast('📸 Auto-captured!'); } } 
  else if (attachedImage) { appendImageMsg('user', attachedImage); }

  appendMsg('user', text); await doChat(text, attachedImage);
}

function sendSug(t) { document.getElementById('userInput').value = t; sendChat(); }

async function doChat(userText, imageDataUrl = null) {
  isBusy = true; document.getElementById('sendBtn').disabled = true; const typEl = showTyping();
  try {
    const { reply, emotion, toolCalls } = await callGemini(userText, imageDataUrl);
    removeTyping(typEl); appendMsg('bot', reply, toolCalls.map(t => t.name)); setEmotion(emotion); speak(reply);
    addToHistory('user', userText, imageDataUrl); addToHistory('model', reply); await executeTools(toolCalls);
  } catch(e) {
    removeTyping(typEl); appendMsg('bot', `❌ ${e.message}`, []); setEmotion('sad'); speak('Oops! Error.');
  } finally { isBusy = false; document.getElementById('sendBtn').disabled = false; }
}

function addToHistory(role, text, imageBase64 = null) { chatHistory.push({ role, text, imageBase64 }); if (chatHistory.length > MAX_HISTORY) chatHistory.splice(0, chatHistory.length - MAX_HISTORY); try { sessionStorage.setItem('petro_history', JSON.stringify(chatHistory.map(m => ({...m, imageBase64: null})))); } catch {} updateMemoryPill(); }
function loadHistory() { try { const saved = sessionStorage.getItem('petro_history'); if (saved) chatHistory = JSON.parse(saved); } catch {} }
function clearChat() { chatHistory = []; try { sessionStorage.removeItem('petro_history'); } catch {} document.getElementById('messages').innerHTML = `<div class="msg bot"><div class="msg-label">petRO 🤖</div><div class="msg-bubble">Fresh start! ✨</div></div>`; toast('Chat cleared'); updateMemoryPill(); }
function updateMemoryPill() { document.getElementById('memoryPill').textContent = `Memory: ${chatHistory.length} / ${MAX_HISTORY} msgs`; }

// ════════════════════════════════════════════════════════
// CAMERA
// ════════════════════════════════════════════════════════
async function initCamera() { try { videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } }); document.getElementById('webcamView').srcObject = videoStream; } catch(e) { console.warn('Camera unavailable:', e); } }
function captureSnapshot() { const video = document.getElementById('webcamView'), canvas = document.getElementById('captureCanvas'); if (!video || !canvas || !videoStream) { toast('⚠️ Camera not ready'); return null; } const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480; ctx.drawImage(video, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', 0.85); }
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
  
  if (theme === 'terminator') { pitch = 0.4; rate = 0.9; } 
  else if (theme === 'transformer') { pitch = 0.1; rate = 0.85; } 
  else if (theme === 'monkey') { pitch = 1.5; rate = 1.25; } 
  else if (theme === 'dog') { pitch = 1.3; rate = 1.15; } 
  else if (theme === 'starwars') { pitch = 1.8; rate = 1.4; }
  
  utt.pitch = pitch; utt.rate = rate; utt.volume = 1;
  const voices = synth.getVoices(); const pref = voices.find(v => /female|zira|samantha|karen|moira|fiona/i.test(v.name)) || voices.find(v => v.lang.startsWith('en')) || voices[0];
  if (pref) utt.voice = pref;
  utt.onstart = () => { ttsActive = true; updateTTSBtn(); animateMouth(true); };
  utt.onend   = () => { ttsActive = false; updateTTSBtn(); animateMouth(false); };
  utt.onerror = () => { ttsActive = false; updateTTSBtn(); animateMouth(false); };
  synth.speak(utt);
}
function stopTTS() { synth?.cancel(); ttsActive = false; updateTTSBtn(); animateMouth(false); }
function updateTTSBtn() { document.getElementById('ttsBtn').className = ttsActive ? 'icon-btn speaking' : 'icon-btn'; }
function animateMouth(talking) {
  if (mouthTalkAnim) { cancelAnimationFrame(mouthTalkAnim); mouthTalkAnim = null; }
  if (!talking) { applyMouthForEmotion(currentEmotion); return; }
  let t = 0; const em = emotions[currentEmotion] || emotions.neutral;
  (function frame() { t += 0.18; setMouthPath(em.mouthType, (em.mouthOpen || 0) + Math.abs(Math.sin(t)) * 12); mouthTalkAnim = requestAnimationFrame(frame); })();
}

// ════════════════════════════════════════════════════════
// EXPRESSIVE FACE ENGINE (Autonomous Eye Movement)
// ════════════════════════════════════════════════════════
const eyeEls = {}; let eyeOff = {lx:0,ly:0,rx:0,ry:0}; let eyeTgt = {lx:0,ly:0,rx:0,ry:0};

function initEyes() {
  ['lIris','lPupil','lLidTop','lLidBot','lHL1','lHL2','lRim','lBrow', 'rIris','rPupil','rLidTop','rLidBot','rHL1','rHL2','rRim','rBrow'].forEach(k => eyeEls[k] = document.getElementById(k));
  runEyeLoop(); scheduleBlink(); scheduleEyeMove();
}
function runEyeLoop() { (function loop() { const s = 0.12; eyeOff.lx += (eyeTgt.lx - eyeOff.lx)*s; eyeOff.ly += (eyeTgt.ly - eyeOff.ly)*s; eyeOff.rx += (eyeTgt.rx - eyeOff.rx)*s; eyeOff.ry += (eyeTgt.ry - eyeOff.ry)*s; setEyePos('l', 65+eyeOff.lx, 88+eyeOff.ly); setEyePos('r',235+eyeOff.rx, 88+eyeOff.ry); requestAnimationFrame(loop); })(); }
function scheduleEyeMove() {
  if (!isSleeping) {
    if (Math.random() > 0.4) { const angle = Math.random() * Math.PI * 2; const radius = Math.random() * 12; eyeTgt.lx = Math.cos(angle) * radius; eyeTgt.ly = Math.sin(angle) * radius; eyeTgt.rx = eyeTgt.lx; eyeTgt.ry = eyeTgt.ly; } 
    else { eyeTgt.lx = 0; eyeTgt.ly = 0; eyeTgt.rx = 0; eyeTgt.ry = 0; }
  } else { eyeTgt.lx = 0; eyeTgt.ly = 0; eyeTgt.rx = 0; eyeTgt.ry = 0; }
  setTimeout(scheduleEyeMove, 1000 + Math.random() * 2500);
}
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
  clearTimeout(emotionResetTimer); if (name !== 'neutral' && name !== 'sleeping' && name !== 'dizzy') emotionResetTimer = setTimeout(() => setEmotion('neutral'), 5000);

  for (const s of ['l','r']) { eyeEls[`${s}Iris`].setAttribute('rx', em.irisR); eyeEls[`${s}Iris`].setAttribute('ry', em.irisR); eyeEls[`${s}Pupil`].setAttribute('rx', em.pupilR); eyeEls[`${s}Pupil`].setAttribute('ry', em.pupilR); eyeEls[`${s}Iris`].style.fill = (name==='neutral') ? 'url(#ig1)' : em.color; eyeEls[`${s}LidTop`].setAttribute('y', em.lidTopY); eyeEls[`${s}LidBot`].setAttribute('y', em.lidBotY); eyeEls[`${s}Rim`].setAttribute('stroke', em.color); }
  eyeEls.lBrow.setAttribute('stroke-width', em.browW); eyeEls.rBrow.setAttribute('stroke-width', em.browW); eyeEls.lBrow.setAttribute('stroke', em.color); eyeEls.rBrow.setAttribute('stroke', em.color);
  if (em.browSlant !== 0) { eyeEls.lBrow.setAttribute('y1', 35 - em.browSlant); eyeEls.lBrow.setAttribute('y2', 35 + em.browSlant); eyeEls.rBrow.setAttribute('y1', 35 + em.browSlant); eyeEls.rBrow.setAttribute('y2', 35 - em.browSlant); } else { eyeEls.lBrow.setAttribute('y1', 35); eyeEls.lBrow.setAttribute('y2', 35); eyeEls.rBrow.setAttribute('y1', 35); eyeEls.rBrow.setAttribute('y2', 35); }
  document.getElementById('tearGroup').style.opacity = em.tears ? '1' : '0'; if (!ttsActive) applyMouthForEmotion(name);
}

function applyMouthForEmotion(name) { const em = emotions[name] || emotions.neutral; setMouthPath(em.mouthType, em.mouthOpen); document.getElementById('mouthRim').setAttribute('stroke', em.color); }
function setMouthPath(type, open = 0) {
  const mp = document.getElementById('mouthPath'); let d = '';
  switch(type) { case 'smile': d = `M 105 165 Q 150 ${178+open} 195 165`; break; case 'laugh': d = `M 105 162 Q 150 ${185+open} 195 162`; break; case 'frown': d = `M 105 174 Q 150 ${162-open} 195 174`; break; case 'flat': d = `M 110 169 L 190 169`; break; case 'small': d = `M 125 168 Q 150 ${174+open} 175 168`; break; case 'sleep': d = `M 125 168 Q 150 168 175 168`; break; case 'wiggle': d = `M 110 169 Q 130 159 150 169 T 190 169`; break; default: d = `M 105 169 Q 150 ${178+open} 195 169`; }
  mp.setAttribute('d', d); if (type === 'laugh') { mp.setAttribute('fill','rgba(0,0,0,0.5)'); mp.setAttribute('stroke-width','2.5'); } else { mp.setAttribute('fill','none'); mp.setAttribute('stroke-width','3.5'); }
}

// ════════════════════════════════════════════════════════
// SLEEP / WAKE / IDLE AUTONOMY / MIC
// ════════════════════════════════════════════════════════
function goToSleep() { if(isSleeping)return; isSleeping=true; setEmotion('sleeping',true); stopTTS(); startZZZ(); }
function wakeUp() { if(!isSleeping)return; isSleeping=false; stopZZZ(); setEmotion('neutral',true); resetInactivity(); }
function startZZZ() { const g = document.getElementById('sleepZZZ'), z1 = document.getElementById('z1'), z2 = document.getElementById('z2'), z3 = document.getElementById('z3'); g.style.opacity = '1'; let t = 0; (function f() { t+=0.03; const b=Math.sin(t)*0.3+0.7; z1.setAttribute('opacity',b); z2.setAttribute('opacity',b*0.7); z3.setAttribute('opacity',b*0.45); z1.setAttribute('y',40-Math.sin(t*0.7)*7); z2.setAttribute('y',24-Math.sin(t*0.7+.5)*7); z3.setAttribute('y',6-Math.sin(t*0.7+1)*7); zzzAnim=requestAnimationFrame(f); })(); }
function stopZZZ() { if(zzzAnim)cancelAnimationFrame(zzzAnim); document.getElementById('sleepZZZ').style.opacity = '0'; }

function resetInactivity() { 
  if(isSleeping) wakeUp(); 
  clearTimeout(inactTimer); 
  inactTimer = setTimeout(() => {
    if (!isBusy && !ttsActive && !isVideoPlaying) { // Won't sleep if watching a video
      setEmotion('dizzy');
      toast('petRO is getting sleepy...');
      setTimeout(() => { if (!isBusy && !ttsActive && !isVideoPlaying && currentEmotion === 'dizzy') goToSleep(); }, 12000);
    }
  }, SLEEP_MS - 12000); 
}

function startIdleWander() {
  clearTimeout(idleWanderTimer);
  idleWanderTimer = setTimeout(() => {
    if(!isSleeping && !isBusy && !ttsActive && !isVideoPlaying && bleConnected) {
      if(Math.random() > 0.4) {
        const slightMoves = ['A', 'C', 'E', 'V', 'U'];
        const mv = slightMoves[Math.floor(Math.random()*slightMoves.length)];
        bleSend(mv);
      }
    }
    startIdleWander();
  }, 10000 + Math.random() * 15000);
}

['click','keydown','touchstart'].forEach(e => document.addEventListener(e, resetInactivity, {passive:true}));

function appendMsg(role, text, actions = []) { const c = document.getElementById('messages'), el = document.createElement('div'); el.className = `msg ${role}`; const lbl = document.createElement('div'); lbl.className = 'msg-label'; lbl.textContent = role === 'user' ? 'You' : 'petRO 🤖'; const bub = document.createElement('div'); bub.className = 'msg-bubble'; bub.textContent = text; el.append(lbl, bub); if (actions?.length) { const chip = document.createElement('div'); chip.className = 'actions-chip'; chip.textContent = '⚡ ' + actions.join(' · '); el.append(chip); } c.append(el); c.scrollTop = c.scrollHeight; }
function showTyping() { const c=document.getElementById('messages'),el=document.createElement('div'); el.className='msg bot'; el.innerHTML=`<div class="msg-label">petRO 🤖</div><div class="typing-wrap"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`; c.append(el); c.scrollTop=c.scrollHeight; return el; }
function removeTyping(el) { el?.remove(); }
function toast(msg) { const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'), 3400); }

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function toggleAlwaysOnMic() { if(!SR){toast('⚠️ Speech API not supported');return;} alwaysOnMic=!alwaysOnMic; if(alwaysOnMic){startBgListen(); updateMicBadge('wake');} else{stopAllRecog(); updateMicBadge('off');} }
function updateMicBadge(state) { const b=document.getElementById('micBadge'); if(state==='off'){b.className='badge mic-off'; b.textContent='🎤 OFF';} if(state==='wake'){b.className='badge mic-wake'; b.textContent='👂 WAKE';} if(state==='cmd'){b.className='badge mic-on'; b.textContent='🔴 REC';} }
function stopAllRecog() { try{bgRecog?.abort();}catch{} try{cmdRecog?.abort();}catch{} bgRecog=null; cmdRecog=null; micState='off'; setListenRipples(false); document.getElementById('wakeOverlay').classList.remove('active'); }
function startBgListen() { if(!alwaysOnMic || micState==='cmd') return; try{bgRecog?.abort();}catch{} bgRecog = new SR(); bgRecog.continuous=true; bgRecog.interimResults=true; bgRecog.lang='en-US'; micState='wake'; bgRecog.onresult = e => { if(micState!=='wake')return; for(let i=e.resultIndex; i<e.results.length; i++){ const t=e.results[i][0].transcript.toLowerCase(); if(WAKE_WORDS.some(w=>t.includes(w))) wakeWordDetected(); } }; bgRecog.onerror = e => { if(e.error!=='aborted') restartBg(); }; bgRecog.onend = () => { if(alwaysOnMic && micState==='wake') setTimeout(restartBg,300); }; try{bgRecog.start();}catch{} }
function restartBg() { if(alwaysOnMic && micState==='wake') startBgListen(); }
function wakeWordDetected() { if(micState==='cmd' || isVideoPlaying) return; try{bgRecog?.abort();}catch{} resetInactivity(); showWakeOverlay(); listenForCommand(); }
function listenForCommand() { micState='cmd'; updateMicBadge('cmd'); setListenRipples(true); cmdRecog = new SR(); cmdRecog.continuous=false; cmdRecog.interimResults=true; const sub = document.getElementById('wakeSub'); sub.textContent = 'Speak your command…'; cmdRecog.onresult = e => { const last = e.results[e.results.length-1]; const t = last[0].transcript; if(last.isFinal){ sub.textContent=`"${t}"`; hideWakeOverlay(); micState='wake'; document.getElementById('userInput').value=t; appendMsg('user',t); doChat(t); setTimeout(startBgListen,800); } else { sub.textContent=t+'…'; } }; cmdRecog.onerror = () => { hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,400); }; cmdRecog.onend = () => { if(micState==='cmd'){hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,400);} }; try{cmdRecog.start();}catch{hideWakeOverlay(); micState='wake'; startBgListen();} }
function cancelWake() { try{cmdRecog?.abort();}catch{} hideWakeOverlay(); micState='wake'; setTimeout(startBgListen,300); }
function showWakeOverlay() { document.getElementById('wakeOverlay').classList.add('active'); updateMicBadge('cmd'); }
function hideWakeOverlay() { document.getElementById('wakeOverlay').classList.remove('active'); setListenRipples(false); updateMicBadge('wake'); }
function setListenRipples(on) { document.getElementById('rippleGroup').style.opacity = on?'1':'0'; if(on) rippleLoop(); }
function rippleLoop() { const r1=document.getElementById('rp1'), r2=document.getElementById('rp2'); let t=0; (function f(){ t+=0.04; const s1=5+Math.sin(t)*10+10, s2=5+Math.sin(t+Math.PI)*10+10; r1.setAttribute('r',s1); r1.setAttribute('opacity',Math.max(0,0.7-s1/30)); r2.setAttribute('r',s2); r2.setAttribute('opacity',Math.max(0,0.5-s2/35)); if(document.getElementById('rippleGroup').style.opacity==='1') requestAnimationFrame(f); })(); }

// ════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  initEyes(); resetInactivity(); initCamera(); loadHistory(); loadPersonalization(); updateKeyBadge(); updateMemoryPill(); applyMouthForEmotion('neutral');
  if (synth) { synth.getVoices(); synth.addEventListener('voiceschanged', () => synth.getVoices()); }
});
