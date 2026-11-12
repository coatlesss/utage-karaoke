// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../core.js');

const SR = 24000;
const chart = U.parseUltraStar(U.DEMO_CHART);

// Voice-like test signal (5 harmonics) following the chart. shape(note, tInNote) returns a semitone offset.
function sing({ shape = () => 0, delay = 0, octave = 0, amp = () => 1 } = {}) {
  const end = chart.notes.at(-1).end + 1, x = new Float32Array(Math.ceil(end * SR));
  for (const n of chart.notes) {
    const s = Math.floor((n.start + delay) * SR), e = Math.min(x.length, Math.floor((n.end + delay) * SR));
    let ph = 0;
    for (let i = s; i < e; i++) {
      const t = (i - s) / SR, f = U.midiToFreq(n.midi + 12 * octave + shape(n, t, (e - s) / SR));
      ph += 2 * Math.PI * f / SR;
      const env = Math.min(1, (i - s) / (0.02 * SR), (e - i) / (0.02 * SR)) * amp(n);
      let v = 0;
      for (let k = 1; k <= 5; k++) v += Math.sin(k * ph) / k;
      x[i] = 0.25 * env * v;
    }
  }
  return x;
}
const score = x => U.analyze(chart, U.trackPitch(x, SR));
const plain = score(sing());

test('YIN finds the pitch of sine and harmonic tones, and nothing in noise', () => {
  for (const f of [110, 196, 220, 440, 659.3]) {
    const b = new Float32Array(1024).map((_, i) => Math.sin(2 * Math.PI * f * i / SR) + 0.4 * Math.sin(4 * Math.PI * f * i / SR));
    assert.ok(Math.abs(U.freqToMidi(U.yin(b, SR)) - U.freqToMidi(f)) < 0.1, `${f} Hz`);
  }
  let seed = 1;
  const noise = new Float32Array(1024).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1);
  assert.equal(U.pitchFrame(noise, SR).midi, null);
  assert.equal(U.pitchFrame(new Float32Array(1024), SR).midi, null);
});

test('UltraStar parsing: timing, pitch, lines, ruby and melisma', () => {
  assert.equal(chart.notes.length, 50);
  assert.equal(chart.lines.length, 7);
  assert.ok(Math.abs(chart.notes[0].start - 3.64) < 1e-9);
  assert.equal(chart.notes[0].midi, 69); // A4
  const quarter = chart.notes[1].start - chart.notes[0].start;
  assert.ok(Math.abs(quarter - 60 / 66) < 1e-9);
  const lines = U.buildLines(chart);
  assert.deepEqual(lines[1].syl.map(s => s.segs.map(g => g.base).join('')), ['や', 'よ', 'い', 'の', '空', 'は']);
  assert.deepEqual(U.parseRuby('見{み}わたす'), [{ base: '見', ruby: 'み' }, { base: 'わたす' }]);
  assert.deepEqual(U.parseRuby('あの空{そら}'), [{ base: 'あの' }, { base: '空', ruby: 'そら' }]);
  // 空 spans its two melisma notes.
  assert.equal(lines[1].syl[4].end, chart.notes[chart.lines[1][6]].end);
});

test('UltraStar relative mode, freestyle notes and round trip', () => {
  const c = U.parseUltraStar('#BPM:60\n#GAP:1000\n#RELATIVE:yes\n: 0 4 0 a\n- 4 8\n: 0 4 2 b\nF 4 2 0 c\nE');
  assert.ok(Math.abs(c.notes[1].start - (1 + 8 * 0.25)) < 1e-9);
  assert.equal(c.notes[2].type, 'F');
  assert.equal(c.lines.length, 2);
  const again = U.parseUltraStar(U.serializeUltraStar(chart));
  assert.deepEqual(again.notes.map(n => [n.midi, n.text, Math.round(n.start * 1000)]), chart.notes.map(n => [n.midi, n.text, Math.round(n.start * 1000)]));
});

test('video tags round-trip and the video follows the audio clock', () => {
  const c = U.parseUltraStar('#BPM:60\n#VIDEO:mv.mp4\n#VIDEOGAP:1,5\n: 0 4 0 a\nE');
  assert.equal(c.video, 'mv.mp4');
  assert.equal(c.videoGap, 1.5);
  assert.equal(U.parseUltraStar(U.serializeUltraStar(c)).videoGap, 1.5);
  assert.deepEqual(U.videoSync(10.5, 10), { seek: 10, rate: 1 }); // far off: jump
  assert.equal(U.videoSync(10.02, 10).seek, null);
  assert.ok(U.videoSync(10.02, 10).rate < 1 && U.videoSync(9.98, 10).rate > 1); // slightly ahead: slow down, behind: speed up
  assert.equal(U.videoSync(10.2, 10).rate, 0.95);
});

test('saved timing fixes shift the whole chart and single lines', () => {
  const c = U.parseUltraStar('#BPM:60\n: 0 4 0 a\n: 4 4 2 b\n- 8\n: 8 4 4 c\nE'); // a 0–1 s, b 1–2 s | c 2–3 s
  const all = U.shiftChart(c, 0.5);
  assert.deepEqual(all.notes.map(n => n.start), [0.5, 1.5, 2.5]);
  assert.equal(c.notes[0].start, 0); // original untouched
  const moved = U.shiftChart(c, 0, { 0: 2.2 }); // first line now starts after the second
  assert.deepEqual(moved.notes.map(n => n.text), ['c', 'a', 'b']);
  assert.deepEqual(U.buildLines(moved).map(l => l.syl.map(s => s.segs[0].base).join('')), ['ab', 'c']);
  assert.equal(U.noteAt(moved.notes, 2.1).text, 'c');
  assert.equal(U.noteAt(moved.notes, 2.5).text, 'a'); // overlap: the note that started last wins
});

test('Shift_JIS charts decode', () => {
  const sjis = Uint8Array.from([0x82, 0xb3, 0x82, 0xad, 0x82, 0xe7]); // さくら
  assert.equal(U.decodeText(sjis), 'さくら');
});

test('accurate singing scores high with no false techniques', () => {
  assert.ok(plain.pitch >= 93, `pitch ${plain.pitch}`);
  assert.ok(plain.rhythm >= 90, `rhythm ${plain.rhythm}`);
  assert.ok(plain.stability >= 95, `stability ${plain.stability}`);
  assert.ok(plain.total >= 85, `total ${plain.total}`);
  assert.equal(plain.shakuri + plain.kobushi + plain.fall + plain.vibrato.count, 0);
});

test('a semitone off loses most pitch points; an octave up does not', () => {
  assert.ok(score(sing({ shape: () => 1 })).pitch <= 40);
  assert.ok(score(sing({ octave: 1 })).pitch >= 93);
});

test('singing 0.2 s late lowers rhythm and reads as タメ', () => {
  const late = score(sing({ delay: 0.2 }));
  assert.ok(late.rhythm < plain.rhythm - 30, `${late.rhythm} vs ${plain.rhythm}`);
  assert.equal(late.tendency, 'タメ');
});

test('vibrato on long notes is detected', () => {
  const r = score(sing({ shape: (n, t, d) => d >= 1.5 && t > 0.3 ? 0.5 * Math.sin(2 * Math.PI * 5.5 * t) : 0 }));
  assert.ok(r.vibrato.count >= 3 && r.vibrato.seconds > 2, JSON.stringify(r.vibrato));
});

test('しゃくり, こぶし and フォール are detected', () => {
  const scoop = score(sing({ shape: (n, t) => t < 0.15 ? -1.5 * (1 - t / 0.15) : 0 }));
  assert.ok(scoop.shakuri >= 5, `shakuri ${scoop.shakuri}`);
  const turn = score(sing({ shape: (n, t, d) => d >= 1.5 && t > 0.6 && t < 0.72 ? 1 : 0 }));
  assert.ok(turn.kobushi >= 3, `kobushi ${turn.kobushi}`);
  const drop = score(sing({ shape: (n, t, d) => d >= 1.5 && t > d - 0.2 ? -3 * (t - (d - 0.2)) / 0.2 : 0 }));
  assert.ok(drop.fall >= 3, `fall ${drop.fall}`);
});

test('silence scores zero', () => {
  assert.equal(score(new Float32Array(SR * 60)).total, 0);
});

test('melody extraction recovers the sung notes', () => {
  const found = U.extractMelody(sing(), SR);
  const hits = chart.notes.filter(n => found.some(f => f.midi === n.midi && f.start < n.end && f.end > n.start)).length;
  assert.ok(hits / chart.notes.length >= 0.9, `${hits}/${chart.notes.length}`);
  const c = U.chartFromNotes(found, { title: 't' });
  assert.ok(c.lines.length >= 5 && c.notes.length >= found.length);
});

test('LRC parsing: repeated stamps, offset, word tags, sorting', () => {
  const l = U.parseLrc('[ar:test]\n[offset:+500]\n[00:05.00]かきくけこ\n[00:01.50][00:09.00]あ<00:01.80>い\n[00:12.00]');
  assert.deepEqual(l.map(x => [x.t, x.text]), [[1, 'あい'], [4.5, 'かきくけこ'], [8.5, 'あい'], [11.5, '']]);
});

test('lyrics split into sung units', () => {
  assert.deepEqual(U.splitMora('きょうは ハッピー'), ['きょ', 'う', 'は ', 'ハ', 'ッ', 'ピー']);
  assert.deepEqual(U.splitMora('「空色」 Love song!'), ['「空', '色」 ', 'Love ', 'song!']);
});

test('furigana from dictionary tokens keeps okurigana outside the ruby', () => {
  const tok = (surface_form, reading) => ({ surface_form, reading });
  assert.equal(U.furigana([tok('取り込む', 'トリコム'), tok('今日', 'キョウ'), tok('は', 'ハ'), tok('見る', 'ミル'), tok('ABC')]), '取{と}り込{こ}む今日{きょう}は見{み}るABC');
  assert.equal(U.furigana([tok('謎', '*')]), '謎'); // unknown reading: left bare
  assert.deepEqual(U.sungUnits('今日{きょう}は'), [{ text: '今日{きょう}', morae: 2 }, { text: 'は', morae: 1 }]);
});

test('a kanji with a reading takes one note per mora', () => {
  const found = [[1, 1.4, 60], [1.5, 1.9, 62], [2, 2.4, 64]].map(([start, end, midi]) => ({ start, end, midi }));
  const c = U.chartFromNotes(found, { title: 't' }, U.parseLrc('[00:01.00]空{そら}は\n[00:03.00]'));
  assert.deepEqual(c.notes.map(n => n.text), ['空{そら}', '~', 'は']);
  assert.deepEqual(U.buildLines(c)[0].syl[0].segs, [{ base: '空', ruby: 'そら' }]);
});

test('moving lyrics on an auto-made chart keeps the melody where the audio has it', () => {
  // melody in two phrases (1–2.9 s and 6–7.4 s); the lyric times are 5 s too early
  const found = [[1, 1.4, 60], [1.5, 1.9, 62], [2.5, 2.9, 64], [6, 6.4, 65], [6.5, 6.9, 67], [7, 7.4, 69]].map(([start, end, midi]) => ({ start, end, midi }));
  const fit = { found, lyrics: U.parseLrc('[00:01.00]あいう\n[00:04.00]\n[00:05.00]かきく\n[00:09.00]') };
  const meta = { title: 't' };
  const before = U.refit(fit, { offset: 0, lines: {} }, meta);
  const ka = before.notes.find(n => n.text === 'か');
  assert.equal(ka.start, 5); // the line starts at its own time (no waiting for the first melody note)…
  assert.equal(ka.type, 'F'); // …and that lead-in is not scored
  assert.equal(before.notes.find(n => n.start === 6).text, '~'); // the melody note at 6 s carries the line on
  const moved = U.refit(fit, { offset: 0, lines: { 1: -4.5 } }, meta); // drag line 2 back to 0.5 s
  const starts = moved.notes.filter(n => n.type !== 'F').map(n => n.start);
  assert.ok(starts.every(s => found.some(f => Math.abs(f.start - s) < 0.03))); // every pitch bar is still a found note
  assert.deepEqual(moved.lines.map(l => l.map(i => moved.notes[i].text).join('')), ['かきく', 'あいう']);
});

test('lyrics are fitted onto the found melody, line by line', () => {
  const found = [[1, 1.4, 60], [1.5, 1.9, 62], [2, 2.4, 64], [2.5, 2.9, 65], [4.1, 4.5, 67], [4.6, 5, 65]].map(([start, end, midi]) => ({ start, end, midi }));
  const lyr = U.parseLrc('[00:01.00]あい\n[00:04.00]かきくけこ\n[00:07.00]空色\n[00:10.00]');
  const c = U.chartFromNotes(found, { title: 't' }, lyr);
  assert.equal(c.lines.length, 3);
  assert.deepEqual(c.lines.map(l => l.map(i => c.notes[i].text)), [['あ', '~', 'い', '~'], ['かき', 'くけこ'], ['空色']]);
  assert.equal(c.notes.at(-1).type, 'F'); // no melody under the third line: shown, not scored
  assert.deepEqual(U.buildLines(c)[0].syl.map(s => s.segs[0].base), ['あ', 'い']);
});

test('latency calibration measures a 120 ms round trip', () => {
  const clicks = [1, 1.6, 2.2, 2.8, 3.4, 4.0], x = new Float32Array(SR * 5);
  for (const c of clicks) for (let i = 0; i < SR * 0.03; i++) x[Math.floor((c + 0.12) * SR) + i] = Math.exp(-i / (SR * 0.005)) * Math.sin(i);
  for (let i = 0; i < x.length; i++) x[i] += 0.002 * Math.sin(i * 0.37);
  const lat = U.measureLatency(clicks, U.detectOnsets(x, SR));
  assert.ok(Math.abs(lat - 0.12) < 0.01, `${lat}`);
});

test('vocal cut removes a centre-panned voice and keeps side content', () => {
  const n = SR, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = Math.sin(2 * Math.PI * 440 * i / SR), g = Math.sin(2 * Math.PI * 660 * i / SR); L[i] = v + g; R[i] = v; }
  const out = U.vocalCut(L, R, SR);
  const corr = f => out.reduce((s, x, i) => s + x * Math.sin(2 * Math.PI * f * i / SR), 0) / n;
  assert.ok(Math.abs(corr(440)) < 0.02 && Math.abs(corr(660)) > 0.2);
});

test('WAV encoding for the vocal separator', () => {
  const w = U.encodeWav([Float32Array.of(0, 1, -2), Float32Array.of(0.5, -0.5, 0)], 44100), v = new DataView(w.buffer);
  assert.equal(String.fromCharCode(...w.slice(0, 4)), 'RIFF');
  assert.equal(v.getUint16(22, true), 2);
  assert.equal(v.getUint32(24, true), 44100);
  assert.equal(v.getUint32(40, true), 12);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(i => v.getInt16(44 + i * 2, true)), [0, 16384, 32767, -16383, -32767, 0]); // interleaved, clipped
});

test('demo audio renders without clipping', () => {
  const b = U.renderDemoBacking(chart, 8000), g = U.renderGuide(chart, 8000);
  assert.ok(b.every(v => Math.abs(v) <= 0.8 + 1e-6) && g.every(v => Math.abs(v) < 1));
});
