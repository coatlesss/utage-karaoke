// 宴 UTAGE — scoring core. Pure functions (no DOM): pitch tracking, UltraStar charts, scoring, synthesis.
// Loaded by index.html as a classic script (window.Utage) and by Node tests (module.exports).
(function (root) {
  'use strict';

  const freqToMidi = f => 69 + 12 * Math.log2(f / 440);
  const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
  // Signed semitone distance to the target, folded so singing an octave off still counts.
  const foldDiff = (sung, target) => { const d = sung - target; return d - 12 * Math.round(d / 12); };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const median = a => {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const rms = b => { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); };
  // ~43 ms analysis window at any sample rate (2048 @ 48 kHz).
  const windowFor = sr => 1 << Math.round(Math.log2(sr * 0.043));

  // ---------- Pitch detection: YIN (de Cheveigné & Kawahara, 2002) ----------
  function yin(buf, sr, opt = {}) {
    const threshold = opt.threshold ?? 0.15, fmin = opt.fmin ?? 70, fmax = opt.fmax ?? 1100;
    const W = buf.length >> 1;
    const tauMin = Math.max(2, Math.floor(sr / fmax)), tauMax = Math.min(W - 2, Math.ceil(sr / fmin));
    const c = new Float32Array(tauMax + 2);
    c[0] = 1;
    let run = 0;
    for (let tau = 1; tau <= tauMax + 1; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const x = buf[j] - buf[j + tau]; s += x * x; }
      run += s;
      c[tau] = run > 0 ? s * tau / run : 1;
    }
    for (let t = tauMin; t <= tauMax; t++) {
      if (c[t] >= threshold) continue;
      while (t + 1 <= tauMax && c[t + 1] < c[t]) t++;
      const a = c[t - 1], b = c[t], d = c[t + 1], den = a - 2 * b + d;
      return sr / (t + (den ? clamp(0.5 * (a - d) / den, -1, 1) : 0));
    }
    return 0;
  }

  function pitchFrame(buf, sr, opt = {}) {
    const r = rms(buf);
    const f = r >= (opt.minRms ?? 0.01) ? yin(buf, sr, opt) : 0;
    return { midi: f > 0 ? freqToMidi(f) : null, rms: r };
  }

  // Offline pitch track; t is the window centre in seconds.
  function trackPitch(x, sr, opt = {}) {
    const win = opt.win ?? windowFor(sr), hop = opt.hop ?? win >> 2, out = [];
    for (let i = 0; i + win <= x.length; i += hop) {
      const p = pitchFrame(x.subarray(i, i + win), sr, opt);
      out.push({ t: (i + win / 2) / sr, midi: p.midi, rms: p.rms });
    }
    return out;
  }

  // ---------- UltraStar charts ----------
  // Files are UTF-8 or (common for Japanese) Shift_JIS.
  function decodeText(bytes) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''); }
    catch { return new TextDecoder('shift_jis').decode(bytes); }
  }

  const num = s => parseFloat(String(s).replace(',', '.'));

  function parseUltraStar(text) {
    const head = {}, notes = [], lines = [[]];
    let offset = 0;
    const raw = [];
    for (const l of text.split(/\r?\n/)) {
      if (l.startsWith('#')) { const k = l.indexOf(':'); if (k > 0) head[l.slice(1, k).trim().toUpperCase()] = l.slice(k + 1).trim(); continue; }
      if (/^E\b/.test(l)) break;
      const m = /^([:*FRG])\s*(-?\d+)\s+(\d+)\s+(-?\d+)\s?(.*)$/.exec(l);
      if (m) { raw.push({ kind: 'n', type: m[1], beat: +m[2], len: +m[3], pitch: +m[4], text: m[5] }); continue; }
      const b = /^-\s*(-?\d+)(?:\s+(-?\d+))?/.exec(l);
      if (b) raw.push({ kind: 'b', a: +b[1], b: b[2] == null ? null : +b[2] });
    }
    const bpm = num(head.BPM);
    if (!(bpm > 0)) throw new Error('#BPM がありません');
    const gap = num(head.GAP || 0) / 1000, beat = 60 / (bpm * 4), relative = /^yes$/i.test(head.RELATIVE || '');
    for (const r of raw) {
      if (r.kind === 'b') {
        if (lines[lines.length - 1].length) lines.push([]);
        if (relative) offset += r.b ?? r.a;
        continue;
      }
      const start = gap + (offset + r.beat) * beat;
      lines[lines.length - 1].push(notes.length);
      notes.push({ start, end: start + r.len * beat, midi: 60 + r.pitch, text: r.text, type: r.type === ':' || r.type === '*' ? r.type : 'F' });
    }
    if (!lines[lines.length - 1].length) lines.pop();
    if (!notes.length) throw new Error('ノートがありません');
    return { title: head.TITLE || '無題', artist: head.ARTIST || '', audio: head.MP3 || head.AUDIO || '', video: head.VIDEO || '', videoGap: num(head.VIDEOGAP || 0) || 0, bpm, gap, notes, lines };
  }

  // Keeps a muted background video locked to the audio clock: small drift is absorbed by playback rate, large drift by seeking.
  function videoSync(videoTime, expected) {
    const d = videoTime - expected;
    return Math.abs(d) > 0.3 ? { seek: expected, rate: 1 } : { seek: null, rate: clamp(1 - d * 0.5, 0.95, 1.05) };
  }

  function serializeUltraStar(c) {
    const beat = 60 / (c.bpm * 4), b = t => Math.round((t - c.gap) / beat);
    const out = [`#TITLE:${c.title}`, `#ARTIST:${c.artist}`, `#MP3:${c.audio || ''}`, `#BPM:${c.bpm}`, `#GAP:${Math.round(c.gap * 1000)}`];
    if (c.video) out.push(`#VIDEO:${c.video}`, `#VIDEOGAP:${c.videoGap || 0}`);
    c.lines.forEach((line, li) => {
      if (li) out.push(`- ${b(c.notes[c.lines[li - 1].at(-1)].end)}`);
      for (const i of line) { const n = c.notes[i]; out.push(`${n.type} ${b(n.start)} ${Math.max(1, Math.round((n.end - n.start) / beat))} ${n.midi - 60} ${n.text}`); }
    });
    out.push('E');
    return out.join('\n');
  }

  // "見{み}わたす" → [{base:'見', ruby:'み'}, {base:'わたす'}]. The ruby covers the kanji run before '{'.
  function parseRuby(text) {
    const segs = [], isKanji = ch => /[㐀-鿿豈-﫿々〆ヶ]/.test(ch);
    let plain = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch !== '{') { plain += ch; continue; }
      const close = text.indexOf('}', i);
      if (close < 0) { plain += text.slice(i); break; }
      let k = plain.length;
      while (k > 0 && isKanji(plain[k - 1])) k--;
      if (k === plain.length) k = Math.max(0, plain.length - 1);
      if (k) segs.push({ base: plain.slice(0, k) });
      if (plain.length > k) segs.push({ base: plain.slice(k), ruby: text.slice(i + 1, close) });
      plain = '';
      i = close;
    }
    if (plain) segs.push({ base: plain });
    return segs;
  }

  // Display lines: "~" notes extend the previous syllable (melisma), so a kanji wipes across all its notes.
  function buildLines(chart) {
    return chart.lines.map(idx => {
      const syl = [];
      for (const i of idx) {
        const n = chart.notes[i];
        if (n.text.trim() === '~' && syl.length) { syl[syl.length - 1].end = n.end; continue; }
        syl.push({ start: n.start, end: n.end, segs: parseRuby(n.text.replace(/~/g, '')) });
      }
      return { start: syl[0].start, end: syl[syl.length - 1].end, syl };
    }).filter(l => l.syl.length);
  }

  // Saved timing fixes: shift the whole chart by `offset` s and single lines by lineOffsets[lineIndex] s.
  // Notes are re-sorted (a moved line may cross its neighbour) and line indices remapped to match.
  function shiftChart(chart, offset = 0, lineOffsets = {}) {
    const notes = chart.notes.map(n => ({ ...n }));
    chart.lines.forEach((l, li) => { const d = offset + (lineOffsets[li] || 0); for (const i of l) { notes[i].start += d; notes[i].end += d; } });
    const order = notes.map((_, i) => i).sort((a, b) => notes[a].start - notes[b].start || a - b), pos = [];
    order.forEach((old, k) => (pos[old] = k));
    return { ...chart, notes: order.map(i => notes[i]), lines: chart.lines.map(l => l.map(i => pos[i])) };
  }

  function noteAt(notes, t) {
    let lo = 0, hi = notes.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (notes[m].start <= t) lo = m + 1; else hi = m; }
    const n = notes[lo - 1];
    return n && t < n.end ? n : null;
  }

  // ---------- Scoring ----------
  const frameScore = d => clamp(1 - (Math.abs(d) - 0.5) / 0.75, 0, 1);

  function lowerBound(fr, t) {
    let lo = 0, hi = fr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (fr[m].t < t) lo = m + 1; else hi = m; }
    return lo;
  }
  function framesIn(fr, a, b) {
    const out = [];
    for (let i = lowerBound(fr, a); i < fr.length && fr[i].t <= b; i++) out.push(fr[i]);
    return out;
  }
  const toSeq = (frs, target) => frs.filter(f => f.midi != null).map(f => ({ t: f.t, d: foldDiff(f.midi, target) }));
  const smooth = seq => seq.map((p, i) => ({ t: p.t, d: mean(seq.slice(Math.max(0, i - 1), i + 2).map(q => q.d)) }));

  // Marks frames inside a regular 4–8.5 Hz pitch oscillation (vibrato).
  function vibratoMask(seq) {
    const mask = new Array(seq.length).fill(false), W = 0.45;
    for (let a = 0; a < seq.length; a++) {
      let b = a;
      while (b < seq.length && seq[b].t - seq[a].t < W) b++;
      if (seq[b - 1].t - seq[a].t < W * 0.9) break;
      const w = seq.slice(a, b), n = w.length;
      if (n < 12 || w.some((p, k) => k && p.t - w[k - 1].t > 0.05)) continue;
      let st = 0, sd = 0, stt = 0, std = 0;
      for (const p of w) { st += p.t; sd += p.d; stt += p.t * p.t; std += p.t * p.d; }
      const slope = (n * std - st * sd) / (n * stt - st * st || 1), icpt = (sd - slope * st) / n;
      const r = w.map(p => p.d - (slope * p.t + icpt));
      const cross = [];
      for (let k = 1; k < n; k++) if ((r[k - 1] < 0) !== (r[k] < 0)) cross.push(w[k - 1].t + (w[k].t - w[k - 1].t) * (r[k - 1] / (r[k - 1] - r[k])));
      if (cross.length < 3) continue;
      const rate = (cross.length - 1) / (2 * (cross[cross.length - 1] - cross[0]));
      const amp = (Math.max(...r) - Math.min(...r)) / 2;
      const iv = cross.slice(1).map((c, k) => c - cross[k]), m = mean(iv);
      const cv = Math.sqrt(mean(iv.map(x => (x - m) ** 2))) / m;
      if (rate >= 4 && rate <= 8.5 && amp >= 0.15 && amp <= 1.8 && cv < 0.35) for (let k = a; k < b; k++) mask[k] = true;
    }
    return mask;
  }

  // Everything measurable about one chart note. frames must be sorted by t.
  function analyzeNote(notes, i, frames) {
    const n = notes[i], prev = notes[i - 1], next = notes[i + 1];
    const prevEnd = prev ? prev.end : -Infinity, nextStart = next ? next.start : Infinity;
    const res = { dur: n.end - n.start, score: 0, onset: null, sd: null, vibSec: 0, shakuri: false, kobushi: 0, fall: false };
    if (n.type === 'F') return res;

    const inNote = framesIn(frames, n.start, n.end);
    if (inNote.length) res.score = inNote.reduce((s, f) => s + (f.midi == null ? 0 : frameScore(foldDiff(f.midi, n.midi))), 0) / inNote.length;

    // Rhythm: arrival time after a rest (any voicing near the pitch) or at a pitch change (arrival on pitch).
    const gap = n.start - prevEnd, change = prev && Math.abs(foldDiff(prev.midi, n.midi)) >= 1;
    if (gap >= 0.15 || change) {
      const tol = gap >= 0.15 ? 2.5 : 0.75;
      const a = gap >= 0.15 ? Math.max(prevEnd + 0.05, n.start - 0.3) : Math.max(prev.start + 0.1, n.start - 0.25);
      const f0 = framesIn(frames, a, n.start + 0.4).find(f => f.midi != null && Math.abs(foldDiff(f.midi, n.midi)) <= tol);
      if (f0) res.onset = f0.t - n.start;
    }

    const seq = smooth(toSeq(inNote, n.midi)), mask = vibratoMask(seq);
    for (let k = 0, s = -1; k <= seq.length; k++) {
      if (k < seq.length && mask[k]) { if (s < 0) s = k; continue; }
      if (s >= 0) { const len = seq[k - 1].t - seq[s].t; if (len >= 0.35) res.vibSec += len; s = -1; }
    }

    // Stability: spread of a held note, ignoring the attack, the release and any vibrato.
    if (res.dur >= 0.5) {
      const held = seq.filter((p, k) => !mask[k] && p.t >= n.start + 0.15 && p.t <= n.end - 0.05).map(p => p.d);
      if (held.length >= 8) { const m = mean(held); res.sd = Math.sqrt(mean(held.map(d => (d - m) ** 2))); }
    }

    // しゃくり: scoop up into the note from below.
    const scoopOk = gap >= 0.08 || !prev || foldDiff(prev.midi, n.midi) > -0.5;
    const early = smooth(toSeq(framesIn(frames, Math.max(prevEnd + 0.03, n.start - 0.12), n.start + 0.4), n.midi));
    if (scoopOk && early.length >= 4 && early[0].d <= -0.7 && early[0].d >= -4) {
      const k = early.findIndex(p => Math.abs(p.d) <= 0.4);
      if (k > 0) {
        const dt = early[k].t - early[0].t;
        let drops = 0;
        for (let j = 1; j <= k; j++) if (early[j].d < early[j - 1].d - 0.3) drops++;
        res.shakuri = dt >= 0.04 && dt <= 0.4 && drops <= 1;
      }
    }

    // こぶし: short excursion away from the held pitch that comes back.
    const mid = seq.filter((p, k) => !mask[k] && p.t >= n.start + 0.12 && p.t <= n.end - 0.08);
    if (mid.length >= 8) {
      const base = median(mid.map(p => p.d));
      let run = [];
      const flush = () => {
        if (run.length >= 2) {
          const dt = run[run.length - 1].t - run[0].t, pk = Math.max(...run.map(p => Math.abs(p.d - base)));
          if (dt <= 0.3 && pk <= 3) res.kobushi++;
        }
        run = [];
      };
      for (const p of mid) {
        const e = p.d - base;
        if (Math.abs(e) < 0.6) { flush(); continue; }
        if (run.length && Math.sign(e) !== Math.sign(run[0].d - base)) flush();
        run.push(p);
      }
    }

    // フォール: pitch drops off at the end of a phrase.
    if (nextStart - n.end >= 0.1) {
      const tail = toSeq(framesIn(frames, n.end - 0.6, Math.min(n.end + 0.4, nextStart - 0.05)), n.midi);
      const ref = tail.filter(p => p.t <= n.end - 0.25).map(p => p.d);
      if (ref.length >= 4 && Math.abs(median(ref)) <= 0.8) {
        const last = tail[tail.length - 1], end = tail.filter(p => p.t >= last.t - 0.3 && p.t > n.end - 0.3);
        if (end.length >= 3) {
          const lo = Math.min(...end.map(p => p.d)), at = end.find(p => p.d === lo);
          res.fall = lo <= median(ref) - 1.5 && at.t >= last.t - 0.1;
        }
      }
    }
    return res;
  }

  const RANKS = [[90, '秀'], [80, '優'], [70, '良'], [60, '可'], [-1, '練']];
  const rankOf = total => RANKS.find(([min]) => total >= min)[1];

  // Message keys (translated by the app): praise for the best area, advice for the weakest.
  function comment(r) {
    if (r.total <= 0) return ['silent'];
    if (r.total >= 95) return ['master'];
    const keys = ['pitch', 'stability', 'rhythm', 'expression'];
    const best = keys.reduce((a, b) => r[b] > r[a] ? b : a), worst = keys.reduce((a, b) => r[b] < r[a] ? b : a);
    const advice = worst === 'rhythm' ? `advice_rhythm${r.tendency === 'タメ' ? '_late' : r.tendency === '走り' ? '_early' : ''}` : `advice_${worst}`;
    return r[best] >= 85 ? [`praise_${best}`, advice] : [advice];
  }

  function analyze(chart, frameList) {
    const frames = [...frameList].sort((a, b) => a.t - b.t), notes = chart.notes;
    const per = notes.map((_, i) => analyzeNote(notes, i, frames));
    const scored = per.filter((_, i) => notes[i].type !== 'F');
    const dur = scored.reduce((s, p) => s + p.dur, 0) || 1;
    const pitch = 100 * scored.reduce((s, p) => s + p.score * p.dur, 0) / dur;
    const voiced = frames.some(f => f.midi != null && noteAt(notes, f.t));

    const onsets = per.map(p => p.onset).filter(o => o != null);
    const rhythm = onsets.length ? 100 * mean(onsets.map(o => clamp(1 - (Math.abs(o) - 0.06) / 0.25, 0, 1))) : pitch;
    const timingMs = onsets.length ? 1000 * mean(onsets) : 0;

    const held = per.filter(p => p.sd != null), heldDur = held.reduce((s, p) => s + p.dur, 0);
    const stability = held.length ? held.reduce((s, p) => s + clamp(100 - (p.sd - 0.08) * 140, 0, 100) * p.dur, 0) / heldDur : pitch;

    const vibSec = per.reduce((s, p) => s + p.vibSec, 0), vibCount = per.filter(p => p.vibSec > 0).length;
    const shakuri = per.filter(p => p.shakuri).length, kobushi = per.reduce((s, p) => s + p.kobushi, 0), fall = per.filter(p => p.fall).length;
    const tech = shakuri + kobushi + fall, lines = chart.lines.length || 1;

    const dbs = frames.filter(f => f.midi != null && noteAt(notes, f.t)).map(f => 20 * Math.log10(f.rms + 1e-9)).sort((a, b) => a - b);
    const range = dbs.length ? dbs[Math.floor(dbs.length * 0.9)] - dbs[Math.floor(dbs.length * 0.1)] : 0;
    const expression = dbs.length ? 100 * (0.55 * clamp((range - 3) / 12, 0, 1) + 0.45 * clamp((tech + vibCount) / lines / 1.5, 0, 1)) : 0;

    const longSec = scored.filter(p => p.dur >= 0.5).reduce((s, p) => s + p.dur, 0);
    const bonus = Math.min(2, vibSec * 0.5) + Math.min(3, tech * 0.3);
    const total = voiced ? Math.round(100 * clamp(0.70 * pitch + 0.10 * stability + 0.10 * rhythm + 0.05 * expression + bonus, 0, 100)) / 100 : 0;
    const r = {
      total, rank: rankOf(total), pitch, stability, rhythm, expression,
      vibratoScore: longSec ? 100 * clamp(vibSec / (0.25 * longSec), 0, 1) : 0,
      techniqueScore: 100 * clamp(tech / lines, 0, 1),
      vibrato: { count: vibCount, seconds: vibSec }, shakuri, kobushi, fall,
      timingMs, tendency: timingMs > 40 ? 'タメ' : timingMs < -40 ? '走り' : 'ジャスト',
      perNote: per.map(p => p.score),
    };
    r.commentKeys = comment(r);
    return r;
  }

  // ---------- Reference melody from audio (best on vocal-only or guide-melody tracks) ----------
  function extractMelody(x, sr) {
    const f = Math.max(1, Math.floor(sr / 11025)), sr2 = sr / f;
    const y = new Float32Array(Math.floor(x.length / f));
    for (let i = 0; i < y.length; i++) { let s = 0; for (let k = 0; k < f; k++) s += x[i * f + k]; y[i] = s / f; }
    const fr = trackPitch(y, sr2, { win: 1024, hop: Math.round(sr2 * 0.01), minRms: 0.01 });
    const sm = fr.map((p, i) => {
      const w = fr.slice(Math.max(0, i - 2), i + 3).map(q => q.midi).filter(m => m != null);
      return { t: p.t, midi: p.midi == null || w.length < 3 ? null : median(w) };
    });
    const out = [];
    let cur = null, pend = null, unv = 0;
    const close = () => { if (cur && cur.end - cur.start >= 0.08) out.push({ start: cur.start, end: cur.end, midi: Math.round(median(cur.v)) }); cur = null; };
    for (const p of sm) {
      if (p.midi == null) { if (++unv >= 4) { close(); pend = null; } continue; }
      unv = 0;
      if (cur && Math.abs(p.midi - cur.sum / cur.v.length) <= 0.7) { cur.v.push(p.midi); cur.sum += p.midi; cur.end = p.t; pend = null; continue; }
      if (cur) { pend ??= { t: p.t, n: 0 }; if (++pend.n < 3) continue; }
      close();
      cur = { start: pend ? pend.t : p.t, end: p.t, v: [p.midi], sum: p.midi };
      pend = null;
    }
    close();
    const merged = [];
    for (const n of out) {
      const last = merged[merged.length - 1];
      if (last && last.midi === n.midi && n.start - last.end < 0.06) last.end = n.end; else merged.push(n);
    }
    return merged;
  }

  // ---------- Line-timed lyrics (.lrc, e.g. from LRCLIB) ----------
  function parseLrc(text) {
    let offset = 0;
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
      const off = /^\[offset:\s*([+-]?\d+)\]/i.exec(raw);
      if (off) { offset = +off[1] / 1000; continue; } // positive offset = lyrics earlier
      const stamps = [];
      let rest = raw, m;
      while ((m = /^\[(\d+):(\d+(?:[.:]\d+)?)\]/.exec(rest))) { stamps.push(+m[1] * 60 + parseFloat(m[2].replace(':', '.'))); rest = rest.slice(m[0].length); }
      const words = rest.replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').trim();
      for (const s of stamps) out.push({ t: s - offset, text: words });
    }
    return out.sort((a, b) => a.t - b.t);
  }

  const KANJI_RUN = /[㐀-鿿豈-﫿々〆ヶ]+/, hasKanji = s => KANJI_RUN.test(s);
  const SMALL_KANA = /[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/;
  const moraCount = kana => [...kana].filter(c => !SMALL_KANA.test(c)).length || 1;
  const kata2hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  // Sung units of a line, each with a mora weight: kana by mora (small kana and ー join the one before),
  // a kanji run with its {reading} weighted by the reading's morae, a bare kanji as 1, Latin words whole.
  function sungUnits(text) {
    const units = [], joinPrev = /^[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮー〜～、。，．！？!?,.・…」』）)\s]$/, opener = /^[「『（(]$/;
    let lead = '';
    for (const tok of text.match(/[㐀-鿿豈-﫿々〆ヶ]+\{[^}]*\}|[A-Za-z0-9'’]+|./gu) || []) {
      if (opener.test(tok)) { lead += tok; continue; }
      if (joinPrev.test(tok)) { if (units.length) units[units.length - 1].text += tok; continue; }
      const ruby = /\{([^}]*)\}$/.exec(tok);
      units.push({ text: lead + tok, morae: ruby ? moraCount(ruby[1]) : 1 });
      lead = '';
    }
    return units;
  }
  const splitMora = text => sungUnits(text).map(u => u.text);

  // Adds {reading} after each kanji run, from morphological tokens ({surface_form, reading} as kuromoji returns them).
  // Okurigana stay outside the ruby: 取り込む/トリコム → 取{と}り込{こ}む. Words whose reading doesn't fit are left bare.
  function furigana(tokens) {
    const esc = s => kata2hira(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return tokens.map(tk => {
      const surf = tk.surface_form;
      if (!hasKanji(surf) || !tk.reading || tk.reading === '*') return surf;
      const parts = surf.match(/[㐀-鿿豈-﫿々〆ヶ]+|[^㐀-鿿豈-﫿々〆ヶ]+/g);
      const m = new RegExp('^' + parts.map(p => hasKanji(p) ? '(.+?)' : esc(p)).join('') + '$').exec(kata2hira(tk.reading));
      if (!m) return surf;
      let k = 1;
      return parts.map(p => hasKanji(p) ? `${p}{${m[k++]}}` : p).join('');
    }).join('');
  }

  // Fits each lyric line onto the melody notes found in its time window. A line with no melody becomes an unscored freestyle note.
  function lyricsToChart(found, lyr, meta) {
    const notes = [], lines = [], lastEnd = found.length ? found[found.length - 1].end : 0;
    lyr.forEach((l, i) => {
      if (!l.text) return;
      const next = lyr.slice(i + 1).find(x => x.t > l.t + 0.01), endT = next ? next.t : Math.max(l.t + 6, lastEnd + 0.5);
      const inLine = found.filter(n => n.start >= l.t - 0.25 && n.start < endT - 0.25), idx = [];
      // The line starts at its own time even when the first melody note comes later: that lead-in is shown, not scored.
      if (inLine.length && inLine[0].start - l.t > 0.15) inLine.unshift({ start: l.t, end: inLine[0].start, midi: inLine[0].midi, lead: true });
      // One slot per mora: a word read in 2 morae takes its slot plus a "~" (hold) slot.
      const slots = sungUnits(l.text).flatMap(u => [u.text, ...Array(u.morae - 1).fill('~')]);
      if (!inLine.length) {
        idx.push(notes.length);
        notes.push({ start: l.t, end: Math.min(endT, l.t + 6), midi: 60, text: l.text, type: 'F' });
      } else if (inLine.length >= slots.length) { // spread syllables evenly; spare notes continue the previous one
        let u = -1;
        for (let k = 0; k < inLine.length; k++) {
          const want = Math.floor(k * slots.length / inLine.length), { lead, ...n } = inLine[k];
          idx.push(notes.length);
          notes.push({ ...n, type: lead ? 'F' : ':', text: want > u ? slots[(u = want)] : '~' });
        }
      } else {
        for (let k = 0; k < inLine.length; k++) {
          const group = slots.slice(Math.floor(k * slots.length / inLine.length), Math.floor((k + 1) * slots.length / inLine.length)), { lead, ...n } = inLine[k];
          idx.push(notes.length);
          notes.push({ ...n, type: lead ? 'F' : ':', text: group.filter(x => x !== '~').join('') || '~' });
        }
      }
      lines.push(idx);
    });
    for (let i = 0; i + 1 < notes.length; i++) notes[i].end = Math.min(notes[i].end, notes[i + 1].start);
    return { title: meta.title, artist: meta.artist || '', audio: meta.audio || '', bpm: 600, gap: 0, notes, lines };
  }

  // Chart from extracted melody notes, with lyrics when a parsed .lrc is given (else every note sings 「ら」).
  function chartFromNotes(found, meta, lyrics) {
    let c;
    if (lyrics && lyrics.some(l => l.text)) c = lyricsToChart(found, lyrics, meta);
    else {
      const notes = found.map(n => ({ ...n, text: 'ら', type: ':' })), lines = [];
      notes.forEach((n, i) => {
        const line = lines[lines.length - 1], prev = notes[i - 1];
        if (!line || n.start - prev.end >= 0.4 || n.end - notes[line[0]].start > 5) lines.push([i]); else line.push(i);
      });
      c = { title: meta.title, artist: meta.artist || '', audio: meta.audio || '', bpm: 600, gap: 0, notes, lines };
    }
    // 600 BPM → 25 ms per UltraStar beat, fine enough for timing.
    return parseUltraStar(serializeUltraStar(c));
  }

  // Auto-made charts (melody found in the audio + timed lyrics) keep the melody fixed and move only the lyrics:
  // the whole-song offset and per-line shifts apply to the lyric times, then the lyrics are fitted onto the melody again.
  // adj.lines is keyed by lyric line (the n-th line with text); an empty "end" marker moves with the line before it.
  function refit(fit, adj, meta) {
    let line = -1;
    const lyr = fit.lyrics.map(l => {
      if (l.text) line++;
      return { t: l.t + (adj.offset || 0) + ((adj.lines || {})[Math.max(0, line)] || 0), text: l.text };
    }).sort((a, b) => a.t - b.t);
    return chartFromNotes(fit.found, meta, lyr);
  }

  // 16-bit PCM WAV from Float32 channel arrays (sent to the vocal separator).
  function encodeWav(channels, sr) {
    const n = channels[0].length, ch = channels.length, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt '); out.setUint32(16, 16, true);
    out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true);
    out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * ch * 2, true);
    for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < ch; c++, o += 2) out.setInt16(o, Math.round(clamp(channels[c][i], -1, 1) * 32767), true);
    return new Uint8Array(out.buffer);
  }

  // ---------- Simple vocal removal: cancel the centre channel, keep the bass ----------
  function vocalCut(L, R, sr) {
    const a = Math.exp(-2 * Math.PI * 120 / sr), out = new Float32Array(L.length), lp = [0, 0, 0, 0];
    for (let i = 0; i < L.length; i++) {
      let m = (L[i] + R[i]) / 2;
      for (let k = 0; k < 4; k++) m = lp[k] = (1 - a) * m + a * lp[k]; // 4-pole low-pass keeps only the bass from the centre
      out[i] = m + (L[i] - R[i]) * 0.7;
    }
    return out;
  }

  // ---------- Latency calibration ----------
  function detectOnsets(x, sr) {
    const hop = Math.max(1, Math.round(sr * 0.005)), env = [];
    for (let i = 0; i + hop <= x.length; i += hop) env.push(rms(x.subarray(i, i + hop)));
    const s = [...env].sort((a, b) => a - b), floor = s[Math.floor(s.length * 0.2)] || 0, peak = s[s.length - 1] || 0;
    const thr = Math.max(floor * 4, floor + (peak - floor) * 0.25, 1e-4), out = [];
    let last = -Infinity;
    for (let k = 0; k < env.length; k++) {
      const t = k * hop / sr;
      if (env[k] >= thr && (k === 0 || env[k - 1] < thr) && t - last > 0.2) { out.push(t); last = t; }
    }
    return out;
  }
  function measureLatency(clicks, onsets) {
    const offs = [];
    for (const c of clicks) { const o = onsets.find(o => o >= c - 0.05 && o <= c + 0.6); if (o != null) offs.push(o - c); }
    return offs.length >= 3 ? median(offs) : null;
  }

  // ---------- Synthesis: guide melody and the demo's 和 backing ----------
  function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const songEnd = c => c.notes.reduce((m, n) => Math.max(m, n.end), 0);

  // Breathy, flute-like guide (尺八 flavour).
  function renderGuide(chart, sr) {
    const out = new Float32Array(Math.ceil((songEnd(chart) + 1) * sr)), rnd = rng(7);
    for (const n of chart.notes) {
      if (n.type === 'F') continue;
      const s = Math.floor(n.start * sr), e = Math.min(out.length, Math.floor(n.end * sr)), w = 2 * Math.PI * midiToFreq(n.midi) / sr;
      for (let i = s, ph = 0; i < e; i++, ph += w) {
        const env = Math.min(1, (i - s) / (0.03 * sr), (e - i) / (0.05 * sr));
        out[i] += env * (0.16 * Math.sin(ph) + 0.04 * Math.sin(2 * ph) + 0.012 * (rnd() * 2 - 1));
      }
    }
    return out;
  }

  function renderDemoBacking(chart, sr, qpm = 66) {
    const len = Math.ceil((songEnd(chart) + 3) * sr), out = new Float32Array(len), rnd = rng(42), q = 60 / qpm;
    const pluck = (t, midi, amp) => { // 箏-like Karplus–Strong string
      const N = Math.round(sr / midiToFreq(midi)), buf = new Float32Array(N), s = Math.floor(t * sr);
      for (let i = 0; i < N; i++) buf[i] = rnd() * 2 - 1;
      for (let i = 0, k = 0; i < sr * 2.5 && s + i < len; i++, k = (k + 1) % N) {
        const v = buf[k];
        buf[k] = 0.4985 * (v + buf[(k + 1) % N]);
        out[s + i] += v * amp;
      }
    };
    const block = t => { // 拍子木 count-in
      const s = Math.floor(t * sr);
      for (let i = 0; i < sr * 0.08 && s + i < len; i++) { const e = Math.exp(-i / (sr * 0.012)); out[s + i] += e * (0.5 * Math.sin(2 * Math.PI * 1900 * i / sr) + 0.3 * Math.sin(2 * Math.PI * 2850 * i / sr) + 0.2 * (rnd() * 2 - 1)); }
    };
    const taiko = t => {
      const s = Math.floor(t * sr);
      for (let i = 0, ph = 0; i < sr * 0.5 && s + i < len; i++) { const f = 45 + 35 * Math.exp(-i / (sr * 0.04)); ph += 2 * Math.PI * f / sr; out[s + i] += 0.55 * Math.exp(-i / (sr * 0.16)) * Math.sin(ph); }
    };
    for (let k = 0; k < 4; k++) block(chart.gap - (4 - k) * q);
    const pattern = [[45, 52], [57], [52, 59], [57]];
    for (let k = 0, t = chart.gap; t < songEnd(chart) + 1; k++, t += q) {
      for (const m of pattern[k % 4]) pluck(t, m, 0.22);
      if (k % 8 === 0) taiko(t);
    }
    for (let i = Math.floor(chart.gap * sr); i < len; i++) { // 笙-like drone
      const t = i / sr, sw = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / (8 * q));
      out[i] += 0.018 * (0.6 + 0.4 * sw) * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 329.63 * t) + 0.6 * Math.sin(2 * Math.PI * 493.88 * t));
    }
    let peak = 0;
    for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 0.8) for (let i = 0; i < len; i++) out[i] *= 0.8 / peak;
    return out;
  }

  // さくらさくら — traditional (1888 lyrics), public domain. 66 BPM quarters = 8 UltraStar beats.
  const DEMO_CHART = (() => {
    const L = 'A4 9|B4 11|C5 12|F4 5|E4 4|C4 0|B3 -1'.split('|').reduce((o, s) => { const [k, v] = s.split(' '); o[k] = +v; return o; }, {});
    const phrases = [
      [['さ', 'A4', 1], ['く', 'A4', 1], ['ら ', 'B4', 2], ['さ', 'A4', 1], ['く', 'A4', 1], ['ら', 'B4', 2]],
      [['や', 'A4', 1], ['よ', 'B4', 1], ['い', 'C5', 1], ['の', 'B4', 1], ['空{そら}', 'A4', 1], ['~', 'B4', 0.5], ['~', 'A4', 0.5], ['は', 'F4', 2]],
      [['見{み}', 'E4', 1], ['わ', 'C4', 1], ['た', 'E4', 1], ['す', 'F4', 1], ['限{かぎ}', 'E4', 1], ['~', 'E4', 0.5], ['~', 'C4', 0.5], ['り', 'B3', 2]],
      [['か', 'A4', 1], ['す', 'B4', 1], ['み', 'C5', 1], ['か', 'B4', 1], ['雲{くも}', 'A4', 1], ['~', 'B4', 0.5], ['~', 'A4', 0.5], ['か', 'F4', 2]],
      [['匂{にお}', 'E4', 1], ['~', 'C4', 1], ['い', 'E4', 1], ['ぞ', 'F4', 1], ['出{い}', 'E4', 1], ['ず', 'E4', 0.5], ['~', 'C4', 0.5], ['る', 'B3', 2]],
      [['い', 'A4', 1], ['ざ', 'A4', 1], ['や ', 'B4', 2], ['い', 'A4', 1], ['ざ', 'A4', 1], ['や', 'B4', 2]],
      [['見{み}', 'E4', 1], ['に', 'F4', 1], ['ゆ', 'B4', 0.5], ['~', 'A4', 0.5], ['か', 'F4', 1], ['ん', 'E4', 3]],
    ];
    const out = ['#TITLE:さくらさくら', '#ARTIST:日本古謡', '#BPM:132', '#GAP:3640'];
    let beat = 0;
    phrases.forEach((ph, pi) => {
      if (pi) out.push(`- ${beat - 1}`);
      ph.forEach(([text, note, q], k) => {
        const len = q * 8, legato = ph[k + 1] && ph[k + 1][0] === '~';
        out.push(`: ${beat} ${legato ? len : len - 1} ${L[note]} ${text}`);
        beat += len;
      });
    });
    out.push('E');
    return out.join('\n');
  })();

  const api = {
    freqToMidi, midiToFreq, foldDiff, frameScore, windowFor, yin, pitchFrame, trackPitch,
    decodeText, parseUltraStar, serializeUltraStar, parseRuby, buildLines, noteAt, shiftChart, videoSync,
    analyzeNote, analyze, rankOf, extractMelody, chartFromNotes, refit, parseLrc, splitMora, sungUnits, furigana, encodeWav, vocalCut,
    detectOnsets, measureLatency, renderGuide, renderDemoBacking, DEMO_CHART,
  };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Utage = api;
})(typeof self !== 'undefined' ? self : this);
