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
const BLE_NAME     = 'petRO';

const DANCE_STEPS = [
  ['L',550],['S',100],['R',550],['S',100],
  ['F',350],['S',80], ['B',350],['S',80],
  ['L',450],['S',80], ['R',450],['S',80],
  ['F',250],['S',50], ['B',250],['S',50],
  ['L',250],['S',30], ['R',250],['S',30],
  ['L',250],['S',30], ['R',250],['S',30],
  ['N',2000],['S',0]
];

// Theme configurations
const THEMES = {
  default: {
    color: '#3b9eff',
    bg: '#090d18',
    surface: '#101623',
    card: '#141e30',
    prompt: "You are petRO, a cute and playful robot with wheels and a servo head. Be playful, warm, and fun. Keep replies SHORT."
  },
  dog: {
    color: '#ff9800',
    bg: '#1a1005',
    surface: '#2b1b0a',
    card: '#3d2610',
    prompt: "You are an energetic and loyal robot dog. Bark playfully in text (e.g. 'Woof!'). Act like a happy puppy. Keep replies SHORT."
  },
  terminator: {
    color: '#ff3333',
    bg: '#0a0000',
    surface: '#1a0000',
    card: '#2a0505',
    prompt: "You are a calculating cyborg T-800. Speak concisely. Use robotic/movie references like 'Affirmative' or 'I will be back'. Keep replies SHORT."
  },
  monkey: {
    color: '#8bc34a',
    bg: '#0a1205',
    surface: '#13240a',
    card: '#1c360e',
    prompt: "You are a cheeky, energetic robot monkey. Make occasional monkey sounds in text (e