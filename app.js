// UTAGE — screens, audio I/O and the singing stage. Scoring lives in core.js.
'use strict';
const U = window.Utage;
const $ = s => document.querySelector(s);
const GOTHIC = '"Yu Gothic UI","Yu Gothic","Meiryo",sans-serif';
const DEMO = { id: 'demo', builtin: true, chartText: U.DEMO_CHART };

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: keeps working for this visit */ } },
};

// ---------- language ----------
const I18N = {
  ja: {
    tagline: 'カラオケ採点', fullscreen: '全画面', langBtn: 'English',
    tileSing: '曲を探す', tileSingSub: '歌いたい曲を選んで採点', tileQuick: '今すぐ歌う', tileHistory: '採点履歴', tileHistorySub: 'これまでの得点',
    tileImport: '曲を取り込む', tileCalib: 'マイク遅延調整', tileCalibSub: '歌と伴奏のずれを補正',
    ticker: 'ようこそ UTAGE へ！　ヘッドホンを使うと採点がより正確になります。　Esc で演奏中止、Space で一時停止して歌詞タイミングを調整、F で全画面。　はじめに「マイク遅延調整」をどうぞ。　UltraStar 譜面や MP3・WAV・FLAC・動画を取り込んで、好きな曲を歌えます。',
    demoTitle: 'さくらさくら', demoArtist: '日本古謡',
    back: '戻る', searchPh: '曲名・歌手名で検索', optGuide: 'ガイドメロディ', optCut: 'ボーカルを消す（分離済みの曲は高音質）',
    optSep: 'ボーカルを分離する（Demucs：正確なメロディと本格カラオケ伴奏）', separating: 'ボーカルを分離中…（この曲は初回のみ）', sepLog: '　ボーカルを分離中…', sepFail: 'ボーカル分離に失敗しました：',
    headphones: 'ヘッドホンの使用をおすすめします。スピーカーの音をマイクが拾うと採点が乱れます。', sing: '歌う', noMatch: '見つかりません', del: '削除', confirmDel: '「{0}」を削除しますか？',
    adjust: '歌詞タイミングを調整', adjusted: '歌詞タイミング調整済み',
    importHelp: 'UltraStar 形式の譜面（.txt）と音源（MP3・WAV・FLAC）を一緒に選んでください。音源だけを選ぶと、歌声からメロディ譜面を自動生成し、歌詞は LRCLIB で検索するか、時間付き歌詞ファイル（.lrc）を一緒に選んで付けられます。動画（MP4・WebM）は演奏中の背景になり、音声が伴奏になります。同じ名前の音源と一緒に選ぶと、音は音源から、映像は動画から使います。',
    optVideo: '動画を背景に使う（オフにすると動画の音声だけを取り込みます）', optFuri: '歌詞にふりがなを自動で付ける',
    lyFor: '「{0}」の歌詞', lyHelp: 'LRCLIB（lrclib.net）で時間付きの歌詞を検索します。長さが音源に近いものほど上に表示されます。', lyTitle: '曲名', lyArtist: '歌手名',
    lySearch: '歌詞を検索', lySearching: '検索中…', lyNoResult: '時間付きの歌詞が見つかりませんでした', lyNeedTitle: '曲名を入力してください', lyPick: '使う',
    lyNone: '歌詞なしで取り込む', lySkip: 'この曲をスキップ', skipped: '　スキップしました', rateLimited: 'LRCLIB が混み合っています。少し待ってから再検索してください',
    furiLoading: '　ふりがな辞書を読み込み中…', furiFail: '　ふりがなを付けられませんでした：',
    pickFiles: 'ファイルを選ぶ', imported: '「{0}」を取り込みました（{1} 音）', needAudio: '「{0}」：音源 {1} も一緒に選んでください', analyzing: '「{0}」の歌声からメロディを解析中…',
    noMelody: '　メロディを検出できませんでした', importedMel: '　「{0}」を取り込みました（{1} 音・歌詞は「ら」で表示）', importedLy: '　「{0}」を歌詞つきで取り込みました（{1} 行）', error: 'エラー：',
    colDate: '日時', colSong: '曲', colScore: '得点', colRank: '評価', noHistory: 'まだ記録がありません',
    calibHelp: '拍子木の音が 10 回鳴ります。音に合わせて手を叩くか「タッ」と声を出してください。伴奏と歌声のずれを測り、採点に反映します。',
    calibStart: '測定を始める', calibSave: '保存', saved: '保存しました', unset: '未設定', measuring: '計測中…',
    calibFail: '音を検出できませんでした。マイクを確かめて、もう一度どうぞ。', calibResult: '測定結果：{0} ms（{1} 回検出）。「保存」で採点に反映します。',
    loading: '準備中…', resultTitle: '採点結果', points: '点', again: 'もう一度', toSongs: '曲選択へ',
    tendency: 'リズムの傾向', early: '走り', just: 'ジャスト', late: 'タメ',
    pitch: '音程', stability: '安定性', rhythm: 'リズム', expression: '表現力', technique: '技巧', vibrato: 'ビブラート', shakuri: 'しゃくり', kobushi: 'こぶし', fall: 'フォール',
    times: '{0}回', vibVal: '{0}回（{1}秒）',
    hint: 'Esc 中断　Space 一時停止して調整　F 全画面　←→ 歌詞タイミング　[ ] この行',
    editMode: '調整モード', editHint: 'Space 再生／停止　ホイール 移動　↑↓ 行を選ぶ　Enter ここから開始　←→ 全体　[ ] 選んだ行　Esc 終了',
    edPrev: '前の行', edNext: '次の行', edStart: 'ここから開始', edStartTip: '選んだ行が今の位置から始まるように合わせます（後ろの行も一緒に動きます）。Enter キーでも可',
    pbAll: '歌詞タイミング', pbLine: 'この行', pbEarlier: '早く', pbLater: '遅く', pbReset: 'クリックで 0 に戻す', volMusic: '伴奏', volGuide: 'ガイド', pbSaved: '保存しました ✓', saveError: '保存できませんでした：',
    edBack: '5 秒戻る', edFwd: '5 秒進む', edPlay: '再生／一時停止（Space）', edPos: '曲の位置', edDone: '完了',
    micError: 'マイクを使えません：', playError: '再生できません：', monoCut: 'モノラル音源のためボーカルカットできません', libError: '曲ライブラリを開けません（ブラウザの保存が無効です）',
    silent: '歌声が聞こえませんでした。マイクの設定を確かめてください。', master: '見事な歌声、まさに名人の域です。',
    praise_pitch: '音程がとても正確です。', praise_stability: 'ロングトーンがまっすぐで美しい。', praise_rhythm: 'リズム感が抜群です。', praise_expression: '抑揚が豊かで心に響きます。',
    advice_pitch: 'ガイドメロディを頼りに、音程を丁寧に合わせましょう。', advice_stability: 'ロングトーンで声が揺れています。お腹で支えてまっすぐ伸ばしましょう。',
    advice_rhythm: 'リズムを意識して、歌い出しを揃えましょう。', advice_rhythm_late: '全体的にタメ気味です。伴奏より半歩早く入る意識で。', advice_rhythm_early: '走り気味です。伴奏をよく聴いて落ち着いて。',
    advice_expression: '強弱や、しゃくり・こぶしで表情をつけてみましょう。',
  },
  en: {
    tagline: 'KARAOKE SCORING', fullscreen: 'Full screen', langBtn: '日本語',
    tileSing: 'Find a song', tileSingSub: 'Pick a song and get scored', tileQuick: 'Sing now', tileHistory: 'Score history', tileHistorySub: 'Your past scores',
    tileImport: 'Add songs', tileCalib: 'Mic latency', tileCalibSub: 'Line your voice up with the music',
    ticker: 'Welcome to UTAGE!   Headphones make scoring more accurate.   Esc stops a song, Space pauses to adjust lyrics timing, F toggles full screen.   Start with "Mic latency".   Add UltraStar charts, MP3 / WAV / FLAC or video files to sing your own songs.',
    demoTitle: 'Sakura Sakura', demoArtist: 'Traditional',
    back: 'Back', searchPh: 'Search by title or artist', optGuide: 'Guide melody', optCut: 'Remove vocals (high quality on separated songs)',
    optSep: 'Separate vocals (Demucs: accurate melody and a real karaoke backing)', separating: 'Separating vocals… (first time for this song only)', sepLog: '  Separating vocals…', sepFail: 'Vocal separation failed: ',
    headphones: 'Headphones recommended: if the mic hears the speakers, it scores the backing instead of you.', sing: 'Sing', noMatch: 'No songs found', del: 'Delete', confirmDel: 'Delete "{0}"?',
    adjust: 'Adjust lyrics timing', adjusted: 'Lyrics timing adjusted',
    importHelp: 'Pick an UltraStar chart (.txt) together with its audio (MP3, WAV, FLAC). Pick audio alone and UTAGE builds a melody chart from the singing, then adds lyrics from LRCLIB or from a timed lyrics file (.lrc) you pick with it. Videos (MP4, WebM) play behind the lyrics and their sound becomes the backing; pick one with a same-named audio file to take the sound from the audio and the picture from the video.',
    optVideo: 'Use videos as the background (off: keep only the sound of video files)', optFuri: 'Add furigana to lyrics automatically',
    lyFor: 'Lyrics for "{0}"', lyHelp: 'Searches LRCLIB (lrclib.net) for timed lyrics. Versions closest in length to your file are listed first.', lyTitle: 'Title', lyArtist: 'Artist',
    lySearch: 'Search lyrics', lySearching: 'Searching…', lyNoResult: 'No timed lyrics found', lyNeedTitle: 'Enter a title', lyPick: 'Use',
    lyNone: 'Add without lyrics', lySkip: 'Skip this song', skipped: '  Skipped', rateLimited: 'LRCLIB is busy — wait a moment and search again',
    furiLoading: '  Loading the furigana dictionary…', furiFail: '  Could not add furigana: ',
    pickFiles: 'Choose files', imported: 'Added "{0}" ({1} notes)', needAudio: '"{0}": also pick its audio {1}', analyzing: 'Finding the melody in "{0}"…',
    noMelody: '  No melody found', importedMel: '  Added "{0}" ({1} notes; lyrics show as "ら")', importedLy: '  Added "{0}" with lyrics ({1} lines)', error: 'Error: ',
    colDate: 'Date', colSong: 'Song', colScore: 'Score', colRank: 'Rank', noHistory: 'No scores yet',
    calibHelp: 'You will hear 10 clicks. Clap or say "ta" in time with them. UTAGE measures the delay between the music and your voice and uses it when scoring.',
    calibStart: 'Start', calibSave: 'Save', saved: 'Saved', unset: 'Not set', measuring: 'Measuring…',
    calibFail: "Couldn't hear the claps. Check the mic and try again.", calibResult: 'Measured {0} ms ({1} claps heard). Press Save to use it.',
    loading: 'Loading…', resultTitle: 'Results', points: 'pts', again: 'Sing again', toSongs: 'Song list',
    tendency: 'Timing', early: 'Ahead', just: 'On time', late: 'Behind',
    pitch: 'Pitch', stability: 'Stability', rhythm: 'Rhythm', expression: 'Expression', technique: 'Technique', vibrato: 'Vibrato', shakuri: 'Scoop', kobushi: 'Kobushi', fall: 'Fall',
    times: '×{0}', vibVal: '×{0} ({1} s)',
    hint: 'Esc stop   Space pause & adjust   F full screen   ←→ lyrics timing   [ ] this line',
    editMode: 'Adjust mode', editHint: 'Space play/pause   wheel scroll   ↑↓ pick line   Enter start here   ←→ whole song   [ ] picked line   Esc exit',
    edPrev: 'Previous line', edNext: 'Next line', edStart: 'Start here', edStartTip: 'Make the picked line start at the current position (the lines after it move along). Enter does the same',
    pbAll: 'Lyrics timing', pbLine: 'This line', pbEarlier: 'Earlier', pbLater: 'Later', pbReset: 'Click to reset to 0', volMusic: 'Music', volGuide: 'Guide', pbSaved: 'Saved ✓', saveError: "Couldn't save: ",
    edBack: 'Back 5 s', edFwd: 'Forward 5 s', edPlay: 'Play / pause (Space)', edPos: 'Position in the song', edDone: 'Done',
    micError: "Can't use the microphone: ", playError: "Can't play: ", monoCut: 'Vocal cut needs stereo audio', libError: "Can't open the song library (browser storage is off)",
    silent: 'No singing was heard. Check the microphone.', master: 'Masterful singing!',
    praise_pitch: 'Your pitch is spot on. ', praise_stability: 'Your long notes are rock steady. ', praise_rhythm: 'Great sense of rhythm. ', praise_expression: 'Lovely, expressive dynamics. ',
    advice_pitch: 'Lean on the guide melody and match each note carefully.', advice_stability: 'Long notes wobble — support them from the belly and hold them straight.',
    advice_rhythm: 'Watch the timing and start each phrase with the music.', advice_rhythm_late: 'You tend to come in late — aim half a beat earlier.', advice_rhythm_early: 'You tend to rush — listen to the backing and settle in.',
    advice_expression: 'Add some loud and soft, or scoops and turns, for more feeling.',
  },
};
const forced = new URLSearchParams(location.search).get('lang');
let lang = forced || store.get('utage.lang', 'ja');
const t = (k, ...a) => (I18N[lang][k] ?? I18N.ja[k] ?? k).replace(/\{(\d)\}/g, (_, i) => a[i]);
const RANK_EN = { 秀: 'S', 優: 'A', 良: 'B', 可: 'C', 練: 'D' }, TENDENCY = { タメ: 'late', 走り: 'early', ジャスト: 'just' };
const rankText = r => lang === 'en' ? RANK_EN[r] : r;
const titleOf = s => s.builtin || s.id === 'demo' ? t('demoTitle') : s.title;
const artistOf = s => s.builtin ? t('demoArtist') : s.artist || '';
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-ph]').forEach(el => (el.placeholder = t(el.dataset.i18nPh)));
  document.querySelectorAll('[data-i18n-title]').forEach(el => (el.title = el.ariaLabel = t(el.dataset.i18nTitle)));
  $('#langBtn').textContent = t('langBtn');
  tick();
  if (screen === 'songs') drawSongList();
  if (screen === 'history') renderHistory();
  if (screen === 'calib') initCalib();
  if (screen === 'result' && lastResult) showResult(lastSong, lastResult, false);
}
$('#langBtn').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; store.set('utage.lang', lang); applyLang(); };
function tick() { $('#clock').textContent = new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ja-JP', { hour: '2-digit', minute: '2-digit' }); }
setInterval(tick, 5000);

// ---------- storage (IndexedDB): songs = chart text + audio/video, adjust = saved lyrics timing per song ----------
const db = (() => {
  let p;
  const open = () => p ??= new Promise((res, rej) => {
    const r = indexedDB.open('utage', 2);
    r.onupgradeneeded = () => { for (const n of ['songs', 'adjust']) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'id' }); };
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); res(r.result); };
    r.onerror = () => rej(r.error);
  });
  const run = async (name, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => { const tx = d.transaction(name, mode), q = fn(tx.objectStore(name)); tx.oncomplete = () => res(q.result); tx.onerror = () => rej(tx.error); });
  };
  return {
    all: (name = 'songs') => run(name, 'readonly', s => s.getAll()),
    get: (name, id) => run(name, 'readonly', s => s.get(id)),
    put: (v, name = 'songs') => run(name, 'readwrite', s => s.put(v)),
    del: (id, name = 'songs') => run(name, 'readwrite', s => s.delete(id)),
  };
})();

// Saved lyrics timing: whole-song offset + per-line offsets (seconds). Older versions kept these in localStorage; moved on first use.
async function loadAdjust(id) {
  let a = null;
  try { a = await db.get('adjust', id); } catch { /* storage off: nothing saved */ }
  const legacy = store.get('utage.adjust', {});
  if (!a && legacy[id]) {
    a = { id, offset: legacy[id].offset || 0, lines: legacy[id].lines || {} };
    try { await db.put(a, 'adjust'); delete legacy[id]; store.set('utage.adjust', legacy); } catch { /* keep the legacy copy */ }
  }
  return { offset: a?.offset || 0, lines: { ...(a?.lines || {}) } };
}
async function adjustedIds() {
  const ids = new Set(Object.keys(store.get('utage.adjust', {})));
  try { for (const a of await db.all('adjust')) ids.add(a.id); } catch { /* storage off */ }
  return ids;
}

// Checkbox options are remembered.
const opts = store.get('utage.opts', {});
for (const id of ['optGuide', 'optCut', 'optVideo', 'optFuri', 'optSep']) {
  const el = $('#' + id);
  if (id in opts) el.checked = opts[id];
  el.addEventListener('change', () => { opts[id] = el.checked; store.set('utage.opts', opts); });
}

// ---------- vocal separation (Demucs, run by UTAGE.exe; absent when the page is opened any other way) ----------
let sepState = null;
const sepAvailable = async () => (sepState ??= await fetch('api/separate').then(r => r.ok, () => false));
// Returns { vocals: AudioBuffer, inst: ArrayBuffer (WAV, vocals removed) }.
async function separateAudio(buf) {
  const sr = 44100, off = new OfflineAudioContext(2, Math.ceil(buf.duration * sr), sr), src = off.createBufferSource();
  src.buffer = buf; src.connect(off.destination); src.start();
  const st = await off.startRendering(); // the separator wants 44.1 kHz stereo
  const r = await fetch('api/separate', { method: 'POST', body: U.encodeWav([st.getChannelData(0), st.getChannelData(1)], sr) });
  if (!r.ok) throw new Error((await r.text()).trim().split('\n').pop() || `HTTP ${r.status}`);
  const { id } = await r.json();
  const get = async name => { const x = await fetch(`api/sep/${id}/${name}.wav`); if (!x.ok) throw new Error(`HTTP ${x.status}`); return x.arrayBuffer(); };
  const [vocals, inst] = await Promise.all([get('vocals'), get('accompaniment')]);
  return { vocals: await ac.decodeAudioData(vocals), inst };
}
const setLoading = text => ($('#loading .big').textContent = text);

// ---------- screens ----------
let screen = 'title', lastSong = null, lastResult = null;
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  $('#playbar').hidden = id !== 'play';
  $('#editbar').hidden = !(id === 'play' && session && session.mode === 'edit');
  screen = id;
  if (id === 'songs') renderSongs();
  if (id === 'history') renderHistory();
  if (id === 'calib') initCalib();
  if (id === 'import') sepAvailable().then(ok => ($('#optSepWrap').hidden = !ok));
  if (id === 'loading') setLoading(t('loading'));
}
function toast(msg, ms = 3500) {
  const el = $('#toast');
  el.textContent = msg; el.style.display = 'block';
  clearTimeout(toast.h); toast.h = setTimeout(() => (el.style.display = 'none'), ms);
}
const toggleFS = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
document.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go) show(go.dataset.go);
  if (e.target.closest('[data-act=fullscreen]')) toggleFS();
  const barBtn = e.target.closest('#playbar button, #editbar button');
  if (barBtn) barBtn.blur(); // keep Space for play/pause instead of re-pressing the button
});
$('#quick').onclick = () => play(DEMO);
addEventListener('keydown', e => {
  if (e.target.matches('input:not([type=range])')) return;
  if (e.key === 'Escape') { if (screen === 'play') abort(); else if (screen !== 'title') show('title'); return; }
  if ((e.key === 'f' || e.key === 'F') && !e.target.matches('input')) toggleFS();
  if (screen !== 'play' || !session) return;
  if (e.key === ' ') { e.preventDefault(); togglePause(session); return; }
  if (session.mode === 'edit' && !e.target.matches('input')) {
    if (e.key === 'Enter') { e.preventDefault(); startHere(session); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); selectLine(session, e.key === 'ArrowUp' ? -1 : 1); return; }
  }
  const step = e.shiftKey ? 0.01 : 0.05, keys = { ArrowLeft: ['all', -step], ArrowRight: ['all', step], '[': ['line', -step], ']': ['line', step] };
  if (keys[e.key] && !e.target.matches('input')) { e.preventDefault(); nudge(...keys[e.key]); }
});

// ---------- audio ----------
let ac, tap, demoBuf;
async function audio() {
  ac ??= new AudioContext({ latencyHint: 'interactive' });
  if (ac.state !== 'running') await ac.resume();
  return ac;
}
// Worklet posts 512-sample mic blocks stamped with their end frame on the AudioContext clock.
const TAP = `registerProcessor('tap', class extends AudioWorkletProcessor {
  constructor() { super(); this.b = new Float32Array(512); this.n = 0; }
  process(inp) {
    const c = inp[0] && inp[0][0];
    if (c) for (let i = 0; i < c.length; i++) {
      this.b[this.n++] = c[i];
      if (this.n === 512) { this.port.postMessage({ end: currentFrame + i + 1, data: this.b }, [this.b.buffer]); this.b = new Float32Array(512); this.n = 0; }
    }
    return true;
  }
});`;
async function micTap() {
  await audio();
  if (tap) return tap;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([TAP], { type: 'text/javascript' })));
  tap = new AudioWorkletNode(ac, 'tap');
  const mute = ac.createGain();
  mute.gain.value = 0;
  ac.createMediaStreamSource(stream).connect(tap).connect(mute).connect(ac.destination);
  return tap;
}
function mono(data) { const b = ac.createBuffer(1, data.length, ac.sampleRate); b.copyToChannel(data, 0); return b; }
function mixdown(buf) {
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels; }
  return out;
}
function clack(at) { // wood-block click
  if (!ac) return;
  at ??= ac.currentTime;
  const gn = ac.createGain();
  gn.gain.setValueAtTime(0.0001, at);
  gn.gain.exponentialRampToValueAtTime(0.6, at + 0.002);
  gn.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
  gn.connect(ac.destination);
  for (const f of [1900, 2850]) { const o = ac.createOscillator(); o.frequency.value = f; o.connect(gn); o.start(at); o.stop(at + 0.1); }
}
const gainNode = pct => { const gn = ac.createGain(); gn.gain.value = pct / 100; gn.connect(ac.destination); return gn; };

// ---------- a session: mode 'sing' (scored) or 'edit' (pause / scroll / adjust, not scored) ----------
let session = null;
function newSession(song, chart, adj, hopSec, audioDur = Infinity, mode = 'sing', fit = null) {
  const s = { song, base: chart, fit, adj, hopSec, audioDur, mode, paused: false, pos: 0, sel: 0, sources: [], frames: [], trace: [], level: 0, sum: 0, count: 0, evalIdx: 0, pops: [], bursts: [], last: null };
  applyAdjust(s);
  return s;
}
function applyAdjust(s) { // the playing chart = the song's chart + its saved timing shifts
  // Auto-made charts move only the lyrics over the melody found in the audio; hand-made charts move notes and lyrics together.
  s.chart = s.fit ? U.refit(s.fit, s.adj, { title: s.base.title, artist: s.base.artist, audio: s.base.audio }) : U.shiftChart(s.base, s.adj.offset, s.adj.lines);
  s.notes = s.chart.notes;
  s.lines = U.buildLines(s.chart);
  const mids = s.notes.filter(n => n.type !== 'F').map(n => n.midi);
  if (!mids.length) mids.push(60);
  s.lo = Math.min(...mids) - 3; s.hi = Math.max(...mids) + 3;
  s.endT = Math.min(s.audioDur, Math.max(...s.notes.map(n => n.end)) + 4);
  s.barKey = null;
}
const songTime = s => s.preview ?? (s.paused ? s.pos : ac.currentTime - s.t0 - (ac.outputLatency || 0));
function currentLine(s, now) { const i = s.lines.findIndex(l => l.end + 0.3 > now); return i < 0 ? s.lines.length - 1 : i; }

function nudge(kind, d) { // d in seconds; null resets
  const s = session;
  if (!s) return;
  const r3 = x => Math.round(x * 1000) / 1000;
  if (kind === 'all') s.adj.offset = d === null ? 0 : r3(s.adj.offset + d);
  else {
    const i = s.mode === 'edit' ? s.sel : currentLine(s, songTime(s)), v = d === null ? 0 : r3((s.adj.lines[i] || 0) + d);
    if (v) s.adj.lines[i] = v; else delete s.adj.lines[i];
  }
  adjusted(s);
}
// "Start here": the picked line starts at the current position; the lines after it move by the same amount.
function startHere(s) {
  const line = s.lines[s.sel];
  if (!line) return;
  const d = songTime(s) - line.start, r3 = x => Math.round(x * 1000) / 1000;
  for (let j = s.sel; j < s.lines.length; j++) { const v = r3((s.adj.lines[j] || 0) + d); if (v) s.adj.lines[j] = v; else delete s.adj.lines[j]; }
  s.sel = Math.min(s.sel + 1, s.lines.length - 1);
  adjusted(s);
}
function selectLine(s, d) { s.sel = Math.min(Math.max(0, s.sel + d), s.lines.length - 1); s.barKey = null; }
function adjusted(s) {
  applyAdjust(s);
  clearTimeout(s.guideTimer);
  s.guideTimer = setTimeout(() => restartGuide(s), 300); // re-render once nudging pauses
  saveAdjust(s);
}
function saveAdjust(s) { // stored with the song (IndexedDB) shortly after the last change
  clearTimeout(s.saveTimer);
  s.saveTimer = setTimeout(async () => {
    const { offset, lines } = s.adj;
    try {
      if (!offset && !Object.keys(lines).length) await db.del(s.song.id, 'adjust');
      else await db.put({ id: s.song.id, offset, lines: { ...lines } }, 'adjust');
      const legacy = store.get('utage.adjust', {});
      if (legacy[s.song.id]) { delete legacy[s.song.id]; store.set('utage.adjust', legacy); }
      $('#pbSaved').textContent = t('pbSaved');
      clearTimeout(saveAdjust.h); saveAdjust.h = setTimeout(() => ($('#pbSaved').textContent = ''), 1800);
    } catch (e) { toast(t('saveError') + e.message); }
  }, 400);
}
function restartGuide(s) { // the guide is pre-rendered: render it again from the shifted chart
  if (session !== s || !s.guideGain) return;
  s.guideBuf = mono(U.renderGuide(s.chart, ac.sampleRate));
  if (s.paused || !s.guideSrc) return;
  try { s.guideSrc.stop(); } catch { /* already ended */ }
  s.guideSrc = playBuf(s, s.guideBuf, s.guideGain, ac.currentTime + 0.05);
}

// ---------- transport ----------
function playBuf(s, buf, gain, at) { // starts `buf` so it stays on the song clock (song time 0 = buffer start)
  const off = at - s.t0;
  if (off >= buf.duration) return null;
  const n = ac.createBufferSource();
  n.buffer = buf; n.connect(gain);
  n.start(Math.max(at, s.t0), Math.max(0, off));
  s.sources.push(n);
  return n;
}
function stopSources(s) {
  for (const n of s.sources) try { n.stop(); } catch { /* already stopped */ }
  s.sources = []; s.guideSrc = null;
}
function startAudio(s, pos) { // play from song position `pos` (negative = a short lead-in)
  stopSources(s);
  const at = ac.currentTime + 0.05;
  s.t0 = at - pos; s.paused = false;
  playBuf(s, s.musicBuf, s.musicGain, at);
  if (s.guideGain) s.guideSrc = playBuf(s, s.guideBuf, s.guideGain, at);
}
function pauseAudio(s) { if (s.paused) return; s.pos = Math.max(0, songTime(s)); stopSources(s); s.paused = true; }
function seekTo(s, pos) { pos = Math.min(Math.max(0, pos), s.audioDur); if (s.paused) s.pos = pos; else startAudio(s, pos); }
function togglePause(s) {
  if (s.preview != null) return;
  if (s.mode === 'sing') return enterEdit(s); // pausing a scored run turns it into adjust mode
  if (s.paused) startAudio(s, s.pos >= s.audioDur - 0.05 ? 0 : s.pos); else pauseAudio(s);
}
function enterEdit(s) {
  if (tap) tap.port.onmessage = null;
  pauseAudio(s);
  s.mode = 'edit';
  s.sel = currentLine(s, s.pos);
  showEditBar(s);
}
function showEditBar(s) { $('#editbar').hidden = false; $('#edPos').max = String(Math.round(s.audioDur * 100) / 100); s.barKey = null; }
let scrubbing = false;
$('#edPos').addEventListener('pointerdown', () => (scrubbing = true));
addEventListener('pointerup', () => (scrubbing = false));
$('#edPos').oninput = e => session && seekTo(session, +e.target.value);
$('#edPlay').onclick = () => session && togglePause(session);
$('#edBack').onclick = () => session && seekTo(session, songTime(session) - 5);
$('#edFwd').onclick = () => session && seekTo(session, songTime(session) + 5);
$('#edDone').onclick = () => abort();
$('#edStart').onclick = () => session && startHere(session);
$('#edPrev').onclick = () => session && selectLine(session, -1);
$('#edNext').onclick = () => session && selectLine(session, 1);

// ---------- control bar (timing + volume) ----------
const fmtShift = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(2) + 's';
const fmtClock = x => { const v = Math.max(0, x); return `${Math.floor(v / 60)}:${(v % 60).toFixed(2).padStart(5, '0')}`; };
const plainLine = l => l.syl.map(sy => sy.segs.map(sg => sg.base).join('')).join('');
function updateBar(s, now) { // touch the DOM only when shown values change
  const li = s.mode === 'edit' ? s.sel : currentLine(s, now), line = s.adj.lines[li] || 0, key = `${s.adj.offset}|${line}|${s.mode}|${s.paused}|${li}`;
  if (s.mode === 'edit') {
    $('#edTime').textContent = `${fmtClock(now)} / ${fmtClock(s.audioDur === Infinity ? s.endT : s.audioDur)}`;
    if (!scrubbing) $('#edPos').value = String(Math.max(0, now));
  }
  if (key === s.barKey) return;
  s.barKey = key;
  $('#pbAll').textContent = fmtShift(s.adj.offset);
  $('#pbLine').textContent = fmtShift(line);
  $('#edPlay').textContent = s.paused ? '▶' : '❚❚';
  if (s.mode === 'edit' && s.lines[li]) {
    const el = $('#edLine'), num = document.createElement('b');
    num.textContent = `${li + 1}/${s.lines.length}`;
    el.replaceChildren(num, plainLine(s.lines[li]));
  }
}
$('#playbar').addEventListener('click', e => {
  const b = e.target.closest('[data-adj]');
  if (b) { const [kind, d] = b.dataset.adj.split(':'); nudge(kind, +d); }
  if (e.target.id === 'pbAll') nudge('all', null);
  if (e.target.id === 'pbLine') nudge('line', null);
});
const vol = { music: 100, guide: 80, ...store.get('utage.vol', {}) };
$('#volMusic').value = vol.music;
$('#volGuide').value = vol.guide;
for (const k of ['music', 'guide']) {
  $(k === 'music' ? '#volMusic' : '#volGuide').oninput = e => {
    vol[k] = +e.target.value;
    store.set('utage.vol', vol);
    const gn = session && session[k + 'Gain'];
    if (gn) gn.gain.value = vol[k] / 100;
  };
}

// ---------- singing ----------
function addFrame(s, time, midi, rms) {
  const n = U.noteAt(s.notes, time), ref = n || s.last || s.notes[0];
  if (n) s.last = n;
  let hit = false;
  if (n && n.type !== 'F') {
    const sc = midi == null ? 0 : U.frameScore(U.foldDiff(midi, n.midi));
    s.sum += sc; s.count++; hit = sc >= 0.6;
  }
  s.frames.push({ t: time, midi, rms });
  s.trace.push({ t: time, disp: midi == null ? null : ref.midi + U.foldDiff(midi, ref.midi), hit, n });
}
function onMic({ end, data }) {
  const s = session;
  if (!s || s.mode !== 'sing' || s.paused || !s.win) return;
  const w = s.win;
  w.copyWithin(0, data.length);
  w.set(data, w.length - data.length);
  const time = (end - w.length / 2) / ac.sampleRate - s.t0 - s.latency;
  const p = U.pitchFrame(w, ac.sampleRate, { minRms: 0.006 });
  s.level = p.rms;
  if (time > -0.5 && time < s.endT) addFrame(s, time, p.midi, p.rms);
}

async function play(song, mode = 'sing') {
  lastSong = song;
  show('loading');
  if (mode === 'sing') try { await micTap(); } catch (e) { show('songs'); toast(t('micError') + e.message); return; }
  try {
    await audio();
    await new Promise(r => setTimeout(r, 20)); // let the loading screen paint before synthesis
    const chart = U.parseUltraStar(song.chartText), sr = ac.sampleRate, adj = await loadAdjust(song.id);
    let backing, fit = song.fit || null;
    if (song.builtin) backing = demoBuf?.sampleRate === sr ? demoBuf : (demoBuf = mono(U.renderDemoBacking(chart, sr)));
    else {
      const orig = await ac.decodeAudioData(song.audio ? song.audio.slice(0) : await song.video.arrayBuffer());
      let vocals = null, changed = false;
      if (!song.inst && $('#optSep').checked && await sepAvailable()) { // one-time upgrade: real karaoke backing + melody from the voice alone
        setLoading(t('separating'));
        try { const sep = await separateAudio(orig); song.inst = sep.inst; vocals = sep.vocals; changed = true; }
        catch (e) { toast(t('sepFail') + e.message, 6000); }
        setLoading(t('loading'));
      }
      if (vocals && (fit || isAutoChart(chart))) fit = song.fit = fit ? { ...fit, found: U.extractMelody(mixdown(vocals), vocals.sampleRate) } : rebuildFit(chart, vocals);
      else if (!fit && isAutoChart(chart)) { fit = song.fit = rebuildFit(chart, orig); changed = true; }
      if (changed) db.put(song).catch(() => {});
      backing = orig;
      if ($('#optCut').checked) {
        if (song.inst) backing = await ac.decodeAudioData(song.inst.slice(0));
        else if (orig.numberOfChannels > 1) backing = mono(U.vocalCut(orig.getChannelData(0), orig.getChannelData(1), sr));
        else toast(t('monoCut'));
      }
    }
    const s = newSession(song, chart, adj, 512 / sr, backing.duration, mode, fit);
    s.musicBuf = backing;
    s.musicGain = gainNode(vol.music);
    if ($('#optGuide').checked) { s.guideGain = gainNode(vol.guide); s.guideBuf = mono(U.renderGuide(s.chart, sr)); }
    $('#volGuide').disabled = !s.guideGain;
    const saved = store.get('utage.latencyMs', null);
    s.win = new Float32Array(U.windowFor(sr));
    s.latency = saved != null ? saved / 1000 : (ac.outputLatency || 0.04) + (ac.baseLatency || 0.01) + 0.03;
    if (song.video) attachVideo(s, URL.createObjectURL(song.video), chart.videoGap);
    session = s;
    if (mode === 'sing') { startAudio(s, -0.5); tap.port.onmessage = e => onMic(e.data); }
    else { s.paused = true; s.pos = Math.max(0, s.notes[0].start - 2); s.sel = 0; }
    show('play');
  } catch (e) { show('songs'); toast(t('playError') + e.message); }
}
// Charts made by UTAGE from audio + lyrics (600 BPM, no gap, real lyrics rather than 「ら」).
const isAutoChart = c => c.bpm === 600 && c.gap === 0 && c.notes.some(n => { const x = n.text.trim(); return x && x !== 'ら' && x !== '~'; });
// Songs imported before melody + lyrics were kept: find the melody again and read the lyric lines back from the chart.
function rebuildFit(chart, buf) {
  const lyrics = [];
  chart.lines.forEach((l, i) => {
    const notes = l.map(k => chart.notes[k]), end = notes[notes.length - 1].end, next = chart.lines[i + 1];
    lyrics.push({ t: notes[0].start, text: notes.map(n => n.text).filter(x => x.trim() !== '~').join('') });
    if (!next || chart.notes[next[0]].start - end > 1.5) lyrics.push({ t: end + 0.3, text: '' }); // keep instrumental gaps closed
  });
  return { found: U.extractMelody(mixdown(buf), buf.sampleRate), lyrics };
}
function stopAudio(s) {
  if (tap) tap.port.onmessage = null;
  stopSources(s);
  if (s.video) {
    const v = s.video;
    v.pause(); URL.revokeObjectURL(v.src); v.removeAttribute('src'); v.load(); v.style.display = 'none';
  }
}
function abort() { const s = session; session = null; if (s) stopAudio(s); show('songs'); }
function finish(s) {
  session = null;
  stopAudio(s);
  const r = U.analyze(s.chart, s.frames);
  const h = store.get('utage.history', []);
  h.unshift({ at: Date.now(), id: s.song.id, title: s.song.title, total: r.total, rank: r.rank });
  store.set('utage.history', h.slice(0, 300));
  showResult(s.song, r);
}

// ---------- background video (muted; the sound plays through Web Audio so scoring keeps one clock) ----------
function attachVideo(s, url, gap) {
  const v = $('#bgv');
  v.src = url; v.style.display = 'block';
  s.video = v; s.videoGap = gap || 0;
}
function syncVideo(s, now) {
  const v = s.video, expected = now + s.videoGap;
  if (v.readyState < 2) return;
  if (expected < 0 || expected >= v.duration) { if (!v.paused) v.pause(); if (expected < 0 && v.currentTime > 0.05) v.currentTime = 0; return; }
  if (s.preview != null || s.paused) { if (!v.paused) v.pause(); if (Math.abs(v.currentTime - expected) > 0.05) v.currentTime = expected; return; }
  if (v.paused) v.play().catch(() => {});
  const r = U.videoSync(v.currentTime, expected);
  if (r.seek != null) v.currentTime = r.seek; else v.playbackRate = r.rate;
}

// ---------- backgrounds ----------
const cv = $('#stage'), g = cv.getContext('2d');
let W = 0, H = 0, bg;
function rand(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  bg = paintScenery(dpr);
}
// Singing backdrop: night sky, moon, hills, 青海波 waves.
function paintScenery(dpr) {
  const c = document.createElement('canvas'), b = c.getContext('2d');
  c.width = W * dpr; c.height = H * dpr; b.scale(dpr, dpr);
  const sky = b.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#050a1f'); sky.addColorStop(0.55, '#122557'); sky.addColorStop(1, '#22407a');
  b.fillStyle = sky; b.fillRect(0, 0, W, H);
  const r = rand(7);
  b.fillStyle = 'rgba(255,248,230,.75)';
  for (let i = 0; i < 160; i++) { const s = r() * 1.5; b.fillRect(r() * W, r() * H * 0.6, s, s); }
  const mx = W * 0.8, my = H * 0.47, mr = Math.min(W, H) * 0.085;
  const glow = b.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.4);
  glow.addColorStop(0, 'rgba(255,238,195,.32)'); glow.addColorStop(1, 'rgba(255,238,195,0)');
  b.fillStyle = glow; b.fillRect(0, 0, W, H);
  b.fillStyle = '#f7efd6'; b.beginPath(); b.arc(mx, my, mr, 0, Math.PI * 2); b.fill();
  [['#1b3163', 0.62, 0.06, 11], ['#122448', 0.72, 0.06, 23], ['#0a1633', 0.82, 0.05, 37]].forEach(([col, base, amp, seed]) => {
    const rr = rand(seed), k = [rr() * 2 + 1, rr() * 3 + 2, rr() * 6 + 5], ph = [rr() * 6, rr() * 6, rr() * 6];
    b.fillStyle = col; b.beginPath(); b.moveTo(0, H);
    for (let x = 0; x <= W + 4; x += 4) {
      const u = x / W;
      b.lineTo(x, H * (base - amp * (0.6 * Math.sin(u * k[0] * Math.PI + ph[0]) + 0.3 * Math.sin(u * k[1] * Math.PI + ph[1]) + 0.1 * Math.sin(u * k[2] * Math.PI + ph[2]))));
    }
    b.lineTo(W, H); b.fill();
  });
  const R = Math.max(18, H * 0.04);
  b.lineWidth = 1;
  for (let row = 0, y = H * 0.9; y < H + R; row++, y += R * 0.5) {
    for (let x = (row % 2) * R; x < W + R; x += R * 2) {
      b.fillStyle = '#0a1633'; b.beginPath(); b.arc(x, y, R, Math.PI, 0); b.fill();
      b.strokeStyle = 'rgba(216,180,90,.16)';
      for (let k = 1; k <= 4; k++) { b.beginPath(); b.arc(x, y, (R * k) / 4, Math.PI, 0); b.stroke(); }
    }
  }
  return c;
}

// Menu backdrop: a karaoke room — sweeping stage lights, colour bokeh, mirror-ball sparkles.
const ROOM = (() => {
  const r = rand(99), cols = ['255,61,154', '46,230,255', '154,107,255', '255,138,61', '140,255,90'];
  return {
    bokeh: Array.from({ length: 26 }, () => ({ x: r(), y: r(), rad: 0.03 + r() * 0.07, vx: (r() - 0.5) * 0.012, vy: (r() - 0.5) * 0.008, c: cols[Math.floor(r() * cols.length)], a: 0.1 + r() * 0.16, ph: r() * 6 })),
    sparks: Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: 1 + r() * 2.2, ph: r() * 6, sp: 0.015 + r() * 0.035 })),
  };
})();
function drawRoom(T) {
  const sky = g.createLinearGradient(0, 0, W * 0.4, H);
  sky.addColorStop(0, '#120632'); sky.addColorStop(0.55, '#24094f'); sky.addColorStop(1, '#06163d');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'lighter';
  const len = Math.hypot(W, H);
  for (const [fx, c, base, ph] of [[0.06, '255,61,154', 0.95, 0], [0.94, '46,230,255', 2.2, 1.7], [0.5, '154,107,255', 1.57, 3.1]]) {
    const ox = W * fx, oy = -H * 0.05, ang = base + Math.sin(T * 0.45 + ph) * 0.38;
    const gr = g.createRadialGradient(ox, oy, 0, ox, oy, len * 0.9);
    gr.addColorStop(0, `rgba(${c},.32)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(ang - 0.13) * len, oy + Math.sin(ang - 0.13) * len);
    g.lineTo(ox + Math.cos(ang + 0.13) * len, oy + Math.sin(ang + 0.13) * len);
    g.closePath(); g.fill();
  }
  for (const b of ROOM.bokeh) {
    const x = (((b.x + b.vx * T) % 1) + 1) % 1 * W, y = (((b.y + b.vy * T) % 1) + 1) % 1 * H, r = b.rad * Math.min(W, H) * 1.6;
    const a = b.a * (0.75 + 0.25 * Math.sin(T * 0.8 + b.ph)), gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${b.c},${a})`); gr.addColorStop(0.7, `rgba(${b.c},${a * 0.6})`); gr.addColorStop(1, `rgba(${b.c},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#fff';
  for (const p of ROOM.sparks) {
    g.globalAlpha = 0.2 + 0.8 * Math.max(0, Math.sin(T * 2.2 + p.ph));
    g.fillRect(((p.x + p.sp * T) % 1) * W, p.y * H, p.s, p.s);
  }
  g.restore();
}

const petals = Array.from({ length: 36 }, () => newPetal(true));
function newPetal(anywhere) {
  return { x: Math.random() * innerWidth, y: anywhere ? Math.random() * innerHeight : -20, s: 4 + Math.random() * 6, r: Math.random() * 6, vr: Math.random() - 0.5, vy: 16 + Math.random() * 26, sw: Math.random() * 6, a: 0.4 + Math.random() * 0.4 };
}
function drawPetal(x, y, s, rot, alpha) {
  g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = alpha; g.fillStyle = '#f8c4d0';
  g.beginPath(); g.moveTo(0, s);
  g.bezierCurveTo(s * 0.95, s * 0.4, s * 0.75, -s * 0.8, s * 0.2, -s);
  g.lineTo(0, -s * 0.7); g.lineTo(-s * 0.2, -s);
  g.bezierCurveTo(-s * 0.75, -s * 0.8, -s * 0.95, s * 0.4, 0, s);
  g.fill(); g.restore();
}

// ---------- singing stage ----------
function lowerBound(arr, x) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].t < x) lo = m + 1; else hi = m; } return lo; }

function evalNotes(s, now) { // judge each note shortly after it ends, for the live technique badges
  while (s.evalIdx < s.notes.length && s.notes[s.evalIdx].end + 0.45 < now) {
    const i = s.evalIdx++, n = s.notes[i];
    if (n.type === 'F') continue;
    const r = U.analyzeNote(s.notes, i, s.frames);
    [r.shakuri && 'shakuri', r.kobushi && 'kobushi', r.fall && 'fall', r.vibSec > 0 && 'vibrato']
      .filter(Boolean).forEach((key, k) => s.pops.push({ key, n, born: now + k * 0.18 }));
    if (r.score >= 0.7) s.bursts.push({ n, born: now, seed: i + 1 });
  }
  if (s.pops.length > 40) s.pops = s.pops.filter(p => now - p.born < 2);
  if (s.bursts.length > 40) s.bursts = s.bursts.filter(b => now - b.born < 2);
}

function drawPlay(s, now) {
  if (s.mode === 'sing') evalNotes(s, now);
  const nowX = W * 0.25, pps = W / 4.6, top = H * 0.09, bot = H * 0.38;
  const semi = (bot - top) / (s.hi - s.lo), bh = Math.max(7, Math.min(18, semi * 0.85));
  const y = m => Math.min(bot + bh, Math.max(top - bh, bot - (m - s.lo) * semi)), x = tt => nowX + (tt - now) * pps;
  const t0 = now - nowX / pps, t1 = now + (W - nowX) / pps, pTop = top - bh * 1.6, pH = bot - top + bh * 3.2;

  g.fillStyle = 'rgba(5,9,26,.66)'; g.fillRect(0, pTop, W, pH);
  g.fillStyle = '#d8b45a'; g.fillRect(0, pTop, W, 2); g.fillRect(0, pTop + pH - 2, W, 2);
  for (let m = Math.ceil(s.lo); m <= s.hi; m++) {
    if (m % 2) continue;
    g.fillStyle = m % 12 === 0 ? 'rgba(216,180,90,.22)' : 'rgba(216,180,90,.07)';
    g.fillRect(0, bot - (m - s.lo) * semi, W, 1);
  }

  if (s.mode === 'edit' && s.lines[s.sel]) { // the picked line: shaded on the band, or an arrow at the edge when off screen
    const L = s.lines[s.sel], a = x(L.start), b = x(L.end), n = s.sel + 1;
    g.font = `700 ${Math.round(bh + 8)}px ${GOTHIC}`; g.textBaseline = 'top'; g.fillStyle = '#2ee6ff';
    if (b < 0) { g.textAlign = 'left'; g.fillText(`◀ ${n}`, 8, pTop + 6); }
    else if (a > W) { g.textAlign = 'right'; g.fillText(`${n} ▶`, W - 8, pTop + 6); }
    else {
      g.textAlign = 'left'; g.fillText(`▼ ${n}`, Math.max(4, a + 4), pTop + 6);
      g.fillStyle = 'rgba(46,230,255,.13)'; g.fillRect(Math.max(0, a), pTop, Math.min(W, b) - Math.max(0, a), pH);
    }
    g.textBaseline = 'alphabetic';
  }

  for (const n of s.notes) { // gold note bars
    if (n.end < t0 || n.start > t1) continue;
    const x1 = x(n.start), w = Math.max(3, x(n.end) - x1 - 1), yy = y(n.midi) - bh / 2;
    g.beginPath(); g.roundRect(x1, yy, w, bh, 2);
    if (n.type === 'F') { g.setLineDash([4, 4]); g.strokeStyle = 'rgba(243,217,139,.55)'; g.lineWidth = 1; g.stroke(); g.setLineDash([]); continue; }
    const gr = g.createLinearGradient(0, yy, 0, yy + bh);
    gr.addColorStop(0, '#fff0b8'); gr.addColorStop(0.4, '#d8b45a'); gr.addColorStop(1, '#8e6a22');
    g.globalAlpha = n.end < now ? 0.4 : 1; g.fillStyle = gr; g.fill(); g.globalAlpha = 1;
    if (n.type === '*') { g.strokeStyle = '#fffbe6'; g.lineWidth = 2; g.stroke(); }
  }

  const hopPx = s.hopSec * pps + 1, from = lowerBound(s.trace, t0); // red fill where the singer hit the note
  g.save(); g.shadowColor = 'rgba(255,70,30,.85)'; g.shadowBlur = 10; g.fillStyle = '#ff4a2a'; g.beginPath();
  for (let i = from; i < s.trace.length; i++) { const f = s.trace[i]; if (f.hit) g.rect(x(f.t) - hopPx / 2, y(f.n.midi) - bh / 2, hopPx, bh); }
  g.fill(); g.restore();

  g.save(); g.lineWidth = 3; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = 'rgba(255,255,255,.92)'; g.shadowColor = 'rgba(255,255,255,.7)'; g.shadowBlur = 6;
  g.beginPath(); // the sung pitch
  let prev = null;
  for (let i = from; i < s.trace.length; i++) {
    const f = s.trace[i];
    if (f.disp == null) { prev = null; continue; }
    const px = x(f.t), py = y(f.disp);
    if (prev && f.t - prev.t < 0.06) g.lineTo(px, py); else g.moveTo(px, py);
    prev = f;
  }
  g.stroke(); g.restore();

  g.fillStyle = s.mode === 'edit' ? '#2ee6ff' : '#e0452b'; g.fillRect(nowX - 1, pTop, 2, pH);
  for (const yy of [pTop, pTop + pH]) { g.beginPath(); g.moveTo(nowX, yy - 7); g.lineTo(nowX + 6, yy); g.lineTo(nowX, yy + 7); g.lineTo(nowX - 6, yy); g.fill(); }
  const lf = s.trace[s.trace.length - 1];
  if (s.mode === 'sing' && lf && lf.disp != null && now - lf.t < 0.3) {
    g.save(); g.beginPath(); g.arc(x(lf.t), y(lf.disp), bh * 0.62, 0, Math.PI * 2);
    g.fillStyle = lf.hit ? '#ff4a2a' : '#ffffff'; g.shadowColor = g.fillStyle; g.shadowBlur = 14; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#fff6e0'; g.stroke(); g.restore();
  }

  for (const b of s.bursts) { // petals burst off well-sung notes
    const age = now - b.born;
    if (age < 0 || age > 1.1) continue;
    const r = rand(b.seed * 97);
    for (let k = 0; k < 7; k++) {
      const a = r() * Math.PI * 2, v = 40 + r() * 70;
      drawPetal(x(b.n.end) + Math.cos(a) * v * age, y(b.n.midi) + Math.sin(a) * v * age + 40 * age * age, 5 + r() * 3, a + age * 3, 1 - age / 1.1);
    }
  }
  const fs = Math.round(Math.max(14, H * 0.024));
  g.font = `700 ${fs}px ${GOTHIC}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  for (const p of s.pops) { // technique badges
    const age = now - p.born;
    if (age < 0 || age > 1.4) continue;
    const label = t(p.key), px = x(p.n.end), py = y(p.n.midi) - bh - 12 - age * 26, tw = g.measureText(label).width;
    g.globalAlpha = Math.min(1, age / 0.12, (1.4 - age) / 0.4);
    g.beginPath(); g.roundRect(px - tw / 2 - 10, py - fs * 1.05, tw + 20, fs * 1.45, fs * 0.72);
    g.fillStyle = '#ff2e8f'; g.shadowColor = '#ff2e8f'; g.shadowBlur = 12; g.fill(); g.shadowBlur = 0;
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#fff'; g.fillText(label, px, py);
    g.globalAlpha = 1;
  }

  drawLyrics(s, now);

  const hs = Math.round(Math.max(14, H * 0.026)), hy = pTop + pH + 14 + hs;
  g.textAlign = 'left'; g.font = `700 ${hs}px ${GOTHIC}`;
  g.fillStyle = '#ff3d9a'; g.fillRect(W * 0.02, pTop + pH + 14, 4, hs * 1.2);
  const artist = artistOf(s.song);
  g.fillStyle = '#ffffff'; g.fillText(`${titleOf(s.song)}${artist ? '　' + artist : ''}`, W * 0.02 + 12, hy);
  g.textAlign = 'right'; g.fillStyle = s.mode === 'edit' ? '#2ee6ff' : '#ffd34d';
  g.fillText(s.mode === 'edit' ? t('editMode') : `${t('pitch')} ${(s.count ? (100 * s.sum) / s.count : 0).toFixed(1)}%`, W * 0.98, hy);
  if (s.mode === 'edit') {
    g.textAlign = 'center'; g.font = `${Math.round(hs * 0.7)}px ${GOTHIC}`; g.fillStyle = 'rgba(255,255,255,.7)';
    g.fillText(t('editHint'), W / 2, hy + hs * 1.3);
    return;
  }
  const lit = Math.round(Math.min(1, Math.max(0, (20 * Math.log10(s.level + 1e-9) + 60) / 50)) * 10);
  for (let k = 0; k < 10; k++) { g.fillStyle = k < lit ? (k > 7 ? '#ff4a2a' : '#2ee6ff') : 'rgba(255,255,255,.15)'; g.fillRect(W * 0.98 - 8, H * 0.97 - k * 9, 8, 6); }
  g.textAlign = 'left'; g.font = `${Math.round(hs * 0.7)}px ${GOTHIC}`; g.fillStyle = 'rgba(255,255,255,.45)';
  g.fillText(t('hint'), W * 0.02, H * 0.975);
}

const lyricLayout = new WeakMap();
function layout(line, size) {
  const c = lyricLayout.get(line);
  if (c && c.size === size) return c;
  g.font = `700 ${size}px ${GOTHIC}`;
  let xx = 0;
  const syl = line.syl.map(sy => {
    const x0 = xx;
    const segs = sy.segs.map(sg => { const w = g.measureText(sg.base).width, o = { ...sg, x: xx, w }; xx += w; return o; });
    return { start: sy.start, end: sy.end, segs, x0, x1: xx };
  });
  const L = { size, syl, width: xx };
  lyricLayout.set(line, L);
  return L;
}
function drawText(L, X, Y, fs, sung) {
  g.lineJoin = 'round'; g.textBaseline = 'alphabetic';
  const segs = L.syl.flatMap(s => s.segs);
  const pass = (text, size, list, at) => {
    g.font = `700 ${size}px ${GOTHIC}`;
    const strokes = sung ? [['#2a0610', 0.3], ['#ffffff', 0.15]] : [['#0a1533', 0.24]];
    for (const [col, k] of strokes) { g.strokeStyle = col; g.lineWidth = size * k; for (const sg of list) g.strokeText(text(sg), ...at(sg)); }
    g.fillStyle = sung ? '#ff3d6e' : '#ffffff';
    for (const sg of list) g.fillText(text(sg), ...at(sg));
  };
  g.textAlign = 'left';
  pass(sg => sg.base, fs, segs, sg => [X + sg.x, Y]);
  g.textAlign = 'center';
  pass(sg => sg.ruby, fs * 0.4, segs.filter(sg => sg.ruby), sg => [X + sg.x + sg.w / 2, Y - fs * 0.95]);
  g.textAlign = 'left';
}
function drawLyrics(s, now) {
  const size = Math.min(H * 0.078, W * 0.052);
  for (const slot of [0, 1]) { // two staggered rows: alternate lines go left / right
    let i = slot;
    while (i < s.lines.length && s.lines[i].end + 0.6 <= now) i += 2;
    const line = s.lines[i];
    if (!line || (i > 1 && line.start - now > 7)) continue;
    let fs = size, L = layout(line, fs);
    if (L.width > W * 0.86) { fs = size * (W * 0.86) / L.width; L = layout(line, fs); }
    const lift = s.mode === 'edit' ? 0.07 : 0; // room for the adjust bar
    const X = slot ? W * 0.93 - L.width : W * 0.07, Y = H * ((slot ? 0.86 : 0.69) - lift);
    const lead = line.start - (i ? s.lines[i - 1].end : 0), left = line.start - now;
    if (lead >= 3 && left > 0 && left <= 2.4) { // count-in dots
      for (let d = 0; d < Math.ceil(left / 0.8); d++) {
        g.beginPath(); g.arc(X + fs * 0.25 + d * fs * 0.5, Y - fs * 1.5, fs * 0.13, 0, Math.PI * 2);
        g.fillStyle = '#ff3d6e'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
      }
    }
    let wipe = 0;
    for (const sy of L.syl) {
      if (now >= sy.end) { wipe = sy.x1; continue; }
      if (now > sy.start) wipe = sy.x0 + (sy.x1 - sy.x0) * (now - sy.start) / (sy.end - sy.start);
      break;
    }
    drawText(L, X, Y, fs, false);
    if (wipe > 0) { g.save(); g.beginPath(); g.rect(X - fs * 0.3, Y - fs * 2, wipe + fs * 0.3, fs * 2.7); g.clip(); drawText(L, X, Y, fs, true); g.restore(); }
  }
}

// Mouse wheel scrolls through the song in adjust mode (Shift = fine).
cv.addEventListener('wheel', e => {
  const s = session;
  if (screen !== 'play' || !s || s.mode !== 'edit' || s.preview != null) return;
  e.preventDefault();
  seekTo(s, songTime(s) + Math.sign(e.deltaY) * (e.shiftKey ? 0.05 : 0.5));
}, { passive: false });

let lastNow = performance.now();
function loop(ms) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (ms - lastNow) / 1000);
  lastNow = ms;
  const s = session;
  if (!s || screen !== 'play') { drawRoom(ms / 1000); return; }
  const now = songTime(s);
  updateBar(s, now);
  if (s.video) { // video shows through the cleared canvas; darken the lower half so lyrics stay readable
    g.clearRect(0, 0, W, H);
    syncVideo(s, now);
    const sh = g.createLinearGradient(0, H * 0.45, 0, H);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = sh; g.fillRect(0, H * 0.45, W, H * 0.55);
  } else {
    g.drawImage(bg, 0, 0, W, H);
    for (const p of petals) {
      p.y += p.vy * dt; p.x += Math.sin(ms / 1250 + p.sw) * 18 * dt; p.r += p.vr * dt;
      if (p.y > H + 20) Object.assign(p, newPetal(false));
      drawPetal(p.x, p.y, p.s, p.r, p.a);
    }
  }
  drawPlay(s, now);
  if (s.preview != null) return;
  if (s.mode === 'sing' && now > s.endT) finish(s);
  if (s.mode === 'edit' && !s.paused && now >= s.audioDur) { pauseAudio(s); s.pos = s.audioDur; }
}

// ---------- results ----------
function showResult(song, r, animate = true) {
  lastSong = song; lastResult = r;
  if (screen !== 'result') show('result');
  const artist = artistOf(song);
  $('#resSong').textContent = titleOf(song) + (artist ? ' ／ ' + artist : '');
  const rows = [
    ['pitch', `${r.pitch.toFixed(1)}%`], ['stability', `${Math.round(r.stability)}`], ['rhythm', `${Math.round(r.rhythm)}`], ['expression', `${Math.round(r.expression)}`],
    ['vibrato', t('vibVal', r.vibrato.count, r.vibrato.seconds.toFixed(1))], ['shakuri', t('times', r.shakuri)], ['kobushi', t('times', r.kobushi)], ['fall', t('times', r.fall)],
  ];
  const tb = $('#resTech');
  tb.textContent = '';
  for (const [k, v] of rows) { const tr = tb.insertRow(); tr.insertCell().textContent = t(k); tr.insertCell().textContent = v; }
  $('#resTend').textContent = `${t(TENDENCY[r.tendency])} (${r.timingMs >= 0 ? '+' : ''}${Math.round(r.timingMs)} ms)`;
  $('#resGauge').style.left = `${50 + Math.max(-1, Math.min(1, r.timingMs / 200)) * 50}%`;
  $('#resComment').textContent = r.commentKeys.map(k => t(k)).join('');
  const rk = $('#resRank');
  rk.textContent = rankText(r.rank);
  if (!animate) { $('#resScore').textContent = r.total.toFixed(2); drawRadar(r, 1); return; }
  rk.classList.remove('stamp');
  const card = $('.result-card');
  card.style.animation = 'none'; void card.offsetHeight; card.style.animation = '';
  const startAt = matchMedia('(prefers-reduced-motion: reduce)').matches ? -1e9 : performance.now();
  const step = ms => {
    const k = Math.min(1, (ms - startAt) / 1600), e = 1 - (1 - k) ** 3;
    $('#resScore').textContent = (r.total * e).toFixed(2);
    drawRadar(r, Math.min(1, k * 1.6));
    if (k < 1) requestAnimationFrame(step); else { rk.classList.add('stamp'); clack(); }
  };
  requestAnimationFrame(step);
}
function drawRadar(r, k) { // hexagon chart
  const c = $('#radar'), x = c.getContext('2d'), cx = c.width / 2, cy = c.height / 2 + 4, R = 106;
  const axes = [['pitch', r.pitch], ['stability', r.stability], ['rhythm', r.rhythm], ['expression', r.expression], ['technique', r.techniqueScore], ['vibrato', r.vibratoScore]];
  const pt = (i, v) => [cx + Math.sin(i * Math.PI / 3) * R * v, cy - Math.cos(i * Math.PI / 3) * R * v];
  const hex = v => { x.beginPath(); for (let i = 0; i < 6; i++) x[i ? 'lineTo' : 'moveTo'](...pt(i, typeof v === 'number' ? v : v(i))); x.closePath(); };
  x.clearRect(0, 0, c.width, c.height);
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1;
  for (const v of [0.25, 0.5, 0.75, 1]) { hex(v); x.stroke(); }
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(cx, cy); x.lineTo(...pt(i, 1)); x.stroke(); }
  hex(i => k * Math.max(0.03, axes[i][1] / 100));
  x.fillStyle = 'rgba(46,230,255,.3)'; x.fill();
  x.save(); x.shadowColor = '#2ee6ff'; x.shadowBlur = 12; x.strokeStyle = '#2ee6ff'; x.lineWidth = 2.5; x.stroke(); x.restore();
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
  axes.forEach(([key, v], i) => {
    const [px, py] = pt(i, 1.26);
    x.font = `700 15px ${GOTHIC}`; x.fillText(t(key), px, py - 8);
    x.font = `600 13px ${GOTHIC}`; x.fillStyle = '#ffd34d'; x.fillText(String(Math.round(v)), px, py + 10); x.fillStyle = '#fff';
  });
}
$('#again').onclick = () => lastSong && play(lastSong);

// ---------- song list ----------
let library = [DEMO], adjustedSet = new Set();
async function renderSongs() {
  try { library = [DEMO, ...(await db.all()).sort((a, b) => a.created - b.created)]; }
  catch { library = [DEMO]; toast(t('libError')); }
  adjustedSet = await adjustedIds();
  drawSongList();
}
$('#search').oninput = () => drawSongList();
function drawSongList() {
  const q = $('#search').value.trim().toLowerCase(), list = $('#songList'), best = {};
  for (const h of store.get('utage.history', [])) best[h.id] = Math.max(best[h.id] ?? 0, h.total);
  const rows = library.map((s, i) => ({ s, no: i + 1 })).filter(({ s }) => !q || `${titleOf(s)} ${artistOf(s)} ${s.title || ''}`.toLowerCase().includes(q));
  list.textContent = '';
  if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = t('noMatch'); list.append(li); return; }
  for (const { s, no } of rows) {
    const li = document.createElement('li'), b = document.createElement('button');
    b.className = 'row';
    b.innerHTML = '<span class="no"></span><span class="ttl"><span></span><small></small></span><span class="best"></span><span class="go"></span>';
    b.querySelector('.no').textContent = String(no).padStart(4, '0');
    b.querySelector('.ttl span').textContent = titleOf(s);
    b.querySelector('.ttl small').textContent = artistOf(s);
    const best1 = b.querySelector('.best');
    best1.textContent = (s.video ? '🎬 ' : '') + (adjustedSet.has(s.id) ? '⏱ ' : '') + (best[s.id] != null ? `★ ${best[s.id].toFixed(1)}` : '');
    if (adjustedSet.has(s.id)) best1.title = t('adjusted');
    b.querySelector('.go').textContent = `${t('sing')} ▶`;
    b.onclick = () => play(s);
    const ed = document.createElement('button');
    ed.className = 'del'; ed.textContent = '✎'; ed.title = ed.ariaLabel = t('adjust');
    ed.onclick = () => play(s, 'edit');
    li.append(b, ed);
    if (!s.builtin) {
      const d = document.createElement('button');
      d.className = 'del'; d.textContent = '✕'; d.title = d.ariaLabel = t('del');
      d.onclick = async () => {
        if (!confirm(t('confirmDel', s.title))) return;
        await db.del(s.id);
        await db.del(s.id, 'adjust').catch(() => {});
        const legacy = store.get('utage.adjust', {});
        delete legacy[s.id];
        store.set('utage.adjust', legacy);
        renderSongs();
      };
      li.append(d);
    }
    list.append(li);
  }
}

// ---------- import ----------
let importing = false;
$('#files').onchange = async e => {
  const files = [...e.target.files], out = $('#importLog');
  e.target.value = '';
  if (importing) return;
  importing = true;
  out.textContent = '';
  const log = m => (out.textContent += m + '\n');
  try { await importFiles(files, log); } catch (err) { log(t('error') + err.message); }
  importing = false;
};

async function lrclibSearch(title, artist) {
  const get = async params => {
    const u = new URL('https://lrclib.net/api/search');
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    const r = await fetch(u, { headers: { 'Lrclib-Client': 'UTAGE/1.0 (local karaoke app)' } }); // LRCLIB asks browser clients to identify this way
    if (r.status === 429) throw new Error(t('rateLimited'));
    if (!r.ok) throw new Error(`LRCLIB HTTP ${r.status}`);
    return (await r.json()).filter(h => h.syncedLyrics && !h.instrumental);
  };
  const hits = await get({ track_name: title, artist_name: artist });
  return hits.length || !artist ? hits : get({ q: `${artist} ${title}` });
}
const fmtTime = s => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };

// Lets the user pick LRCLIB lyrics for one audio file. Resolves {lrc, title, artist}, {} (no lyrics) or {skip: true}.
function askLyrics(fileName, duration) {
  const box = $('#lyricsBox'), list = $('#lyResults'), stem = fileName.replace(/\.[^.]+$/, '');
  const [artist, title] = stem.includes(' - ') ? stem.split(' - ', 2) : ['', stem]; // "Artist - Title.mp3"
  $('#lyFile').textContent = t('lyFor', fileName);
  $('#lyTitle').value = title.trim();
  $('#lyArtist').value = artist.trim();
  list.textContent = '';
  box.hidden = false;
  const note = msg => { list.textContent = ''; const li = document.createElement('li'); li.className = 'empty'; li.textContent = msg; list.append(li); };
  return new Promise(resolve => {
    const done = v => { box.hidden = true; resolve(v); };
    $('#lyNone').onclick = () => done({});
    $('#lySkip').onclick = () => done({ skip: true });
    $('#lySearch').onclick = async () => {
      const q = $('#lyTitle').value.trim();
      if (!q) return note(t('lyNeedTitle'));
      note(t('lySearching'));
      try {
        const hits = (await lrclibSearch(q, $('#lyArtist').value.trim())).sort((x, y) => Math.abs(x.duration - duration) - Math.abs(y.duration - duration));
        if (!hits.length) return note(t('lyNoResult'));
        list.textContent = '';
        for (const h of hits) {
          const li = document.createElement('li'), b = document.createElement('button'), d = Math.round(h.duration - duration);
          b.className = 'row';
          b.innerHTML = '<span class="no"></span><span class="ttl"><span></span><small></small></span><span class="best"></span><span class="go"></span>';
          b.querySelector('.no').textContent = fmtTime(h.duration);
          b.querySelector('.ttl span').textContent = h.trackName;
          b.querySelector('.ttl small').textContent = [h.artistName, h.albumName].filter(Boolean).join(' · ');
          b.querySelector('.best').textContent = `${d >= 0 ? '+' : ''}${d}s`;
          b.querySelector('.go').textContent = `${t('lyPick')} ▶`;
          b.onclick = () => done({ lrc: h.syncedLyrics, title: h.trackName, artist: h.artistName });
          li.append(b);
          list.append(li);
        }
      } catch (e) { note(t('error') + e.message); }
    };
    $('#lySearch').click();
  });
}
for (const id of ['#lyTitle', '#lyArtist']) $(id).onkeydown = e => { if (e.key === 'Enter') $('#lySearch').click(); };

// Japanese dictionary (kuromoji, bundled in vendor/) for furigana; loaded on first use, ~17 MB.
let tokenizerP = null;
function tokenizer() {
  return tokenizerP ??= new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/kuromoji/kuromoji.js';
    sc.onload = () => window.kuromoji.builder({ dicPath: 'vendor/kuromoji/dict/' }).build((err, tk) => (err ? rej(err) : res(tk)));
    sc.onerror = () => rej(new Error('vendor/kuromoji/kuromoji.js'));
    document.head.append(sc);
  }).catch(e => { tokenizerP = null; throw e; });
}
async function addFurigana(lyrics, log) {
  try {
    if (!tokenizer.ready) log(t('furiLoading'));
    const tk = await tokenizer();
    tokenizer.ready = true;
    return lyrics.map(l => ({ ...l, text: l.text ? U.furigana(tk.tokenize(l.text)) : l.text }));
  } catch (e) { log(t('furiFail') + (e.message || e)); return lyrics; }
}

async function importFiles(files, log) {
  await audio();
  const name = n => n.replace(/^.*[\\/]/, '').toLowerCase(), stem = n => name(n).replace(/\.[^.]+$/, '');
  const isChart = f => /\.txt$/i.test(f.name), isLrc = f => /\.lrc$/i.test(f.name), isVideo = f => /\.(mp4|webm|mov|m4v)$/i.test(f.name);
  const charts = files.filter(isChart), lrcs = files.filter(isLrc), media = files.filter(f => !isChart(f) && !isLrc(f)), used = new Set();
  const videos = media.filter(isVideo), sounds = media.filter(f => !isVideo(f)), useVideo = $('#optVideo').checked;
  // The picture for a sound file: a video with the same name, or the only video when exactly one of each was picked.
  const partner = a => videos.find(v => stem(v.name) === stem(a.name)) || (sounds.length === 1 && videos.length === 1 ? videos[0] : null);
  // Stores the sound to decode plus the video (as a Blob) when wanted; a video that is its own sound is stored once. Returns a log mark.
  // fit = the melody found in the audio + the timed lyrics, kept so timing fixes can move lyrics without moving the melody.
  // inst = the separated backing (WAV) with the vocals removed.
  const save = async (title, artist, chartText, src, vid, bytes, fit, inst) => {
    vid = useVideo ? vid : null;
    await db.put({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, title, artist, chartText,
      audio: src === vid ? null : bytes ?? await src.arrayBuffer(), video: vid || null, fit: fit || null, inst: inst || null, created: Date.now() });
    return vid ? ' 🎬' : '';
  };
  const useSep = $('#optSep').checked && await sepAvailable();
  const separate = async buf => {
    if (!useSep) return null;
    log(t('sepLog'));
    try { return await separateAudio(buf); } catch (e) { log('　' + t('sepFail') + e.message); return null; }
  };
  for (const f of charts) {
    const text = U.decodeText(new Uint8Array(await f.arrayBuffer())), chart = U.parseUltraStar(text);
    const src = media.find(x => name(x.name) === name(chart.audio)) || (sounds.length === 1 ? sounds[0] : media.length === 1 ? media[0] : null);
    if (!src) { log(t('needAudio', chart.title, chart.audio || '')); continue; }
    const vid = isVideo(src) ? src : videos.find(v => name(v.name) === name(chart.video)) || partner(src);
    used.add(src);
    if (vid) used.add(vid);
    const bytes = await src.arrayBuffer(), sep = useSep ? await separate(await ac.decodeAudioData(bytes.slice(0))) : null;
    log(t('imported', chart.title, chart.notes.length) + await save(chart.title, chart.artist, text, src, vid, bytes, null, sep?.inst));
  }
  const primaries = media.filter(x => !used.has(x) && !(isVideo(x) && sounds.some(a => !used.has(a) && partner(a) === x)));
  for (const a of primaries) {
    log(t('analyzing', a.name));
    await new Promise(r => setTimeout(r, 30));
    const bytes = await a.arrayBuffer(), buf = await ac.decodeAudioData(bytes.slice(0));
    const sep = await separate(buf), voice = sep ? sep.vocals : buf; // melody from the isolated voice when separated
    const found = U.extractMelody(mixdown(voice), voice.sampleRate);
    const local = lrcs.find(l => stem(l.name) === stem(a.name)) || (lrcs.length === 1 && primaries.length === 1 ? lrcs[0] : null);
    const pick = local ? { lrc: U.decodeText(new Uint8Array(await local.arrayBuffer())) } : await askLyrics(a.name, buf.duration);
    if (pick.skip) { log(t('skipped')); continue; }
    let lyrics = pick.lrc ? U.parseLrc(pick.lrc) : null;
    const hasLyrics = !!lyrics?.some(l => l.text);
    if (!hasLyrics && found.length < 4) { log(t('noMelody')); continue; }
    if (hasLyrics && $('#optFuri').checked) lyrics = await addFurigana(lyrics, log);
    const title = pick.title || a.name.replace(/\.[^.]+$/, ''), artist = pick.artist || '';
    const chart = U.chartFromNotes(found, { title, artist, audio: a.name }, hasLyrics ? lyrics : null);
    const mark = await save(title, artist, U.serializeUltraStar(chart), a, isVideo(a) ? a : partner(a), bytes, hasLyrics ? { found, lyrics } : null, sep?.inst);
    log((hasLyrics ? t('importedLy', title, chart.lines.length) : t('importedMel', title, found.length)) + mark);
  }
}

// ---------- history ----------
function renderHistory() {
  const tb = $('#histBody'), h = store.get('utage.history', []);
  tb.textContent = '';
  if (!h.length) { tb.insertRow().insertCell().textContent = t('noHistory'); return; }
  for (const e of h) {
    const tr = tb.insertRow();
    for (const v of [new Date(e.at).toLocaleString(lang === 'en' ? 'en-US' : 'ja-JP'), titleOf(e), `${e.total.toFixed(2)} ${t('points')}`, rankText(e.rank)]) tr.insertCell().textContent = v;
  }
}

// ---------- latency calibration ----------
function initCalib() {
  const v = store.get('utage.latencyMs', null);
  $('#latency').value = v ?? 120;
  $('#latencyVal').textContent = v == null ? t('unset') : `${v} ms`;
  $('#calibLog').textContent = '';
}
$('#latency').oninput = e => ($('#latencyVal').textContent = `${e.target.value} ms`);
$('#calibSave').onclick = () => { store.set('utage.latencyMs', +$('#latency').value); toast(t('saved')); };
$('#calibStart').onclick = async () => {
  const log = $('#calibLog');
  try { await micTap(); } catch (e) { log.textContent = t('micError') + e.message; return; }
  const sr = ac.sampleRate, t0 = ac.currentTime + 0.3, clicks = Array.from({ length: 10 }, (_, k) => t0 + 0.8 + k * 0.6);
  const rec = new Float32Array(Math.ceil((clicks[9] - t0 + 1.2) * sr)), first = Math.round(t0 * sr);
  tap.port.onmessage = ({ data }) => {
    const off = data.end - data.data.length - first;
    for (let i = 0; i < data.data.length; i++) if (off + i >= 0 && off + i < rec.length) rec[off + i] = data.data[i];
  };
  clicks.forEach(c => clack(c));
  log.textContent = t('measuring');
  setTimeout(() => {
    tap.port.onmessage = null;
    const onsets = U.detectOnsets(rec, sr).map(o => o + t0), lat = U.measureLatency(clicks, onsets);
    if (lat == null) { log.textContent = t('calibFail'); return; }
    const ms = Math.max(0, Math.round(lat * 1000));
    $('#latency').value = ms; $('#latencyVal').textContent = `${ms} ms`;
    log.textContent = t('calibResult', ms, onsets.length);
  }, (clicks[9] - ac.currentTime + 1.3) * 1000);
};

// ---------- start ----------
addEventListener('resize', resize);
resize();
applyLang();
requestAnimationFrame(loop);
// Dev previews without a mic: ?preview=play&t=20[&mode=edit][&video=<url>], ?preview=result, ?preview=<screen id>.
const qs = new URLSearchParams(location.search), preview = qs.get('preview');
if (preview === 'play' || preview === 'result') {
  const chart = U.parseUltraStar(U.DEMO_CHART), sr = 24000, frames = U.trackPitch(U.renderGuide(chart, sr), sr);
  if (preview === 'result') showResult(DEMO, U.analyze(chart, frames));
  else {
    const s = newSession(DEMO, chart, { offset: 0, lines: {} }, 256 / sr, U.renderGuide(chart, sr).length / sr, qs.get('mode') === 'edit' ? 'edit' : 'sing');
    s.preview = +(qs.get('t') || 20);
    if (s.mode === 'sing') for (const f of frames) if (f.t <= s.preview - 0.08) addFrame(s, f.t, f.midi, f.rms);
    if (qs.get('video')) attachVideo(s, qs.get('video'), 0);
    session = s;
    show('play');
  }
} else show(preview || 'title');
