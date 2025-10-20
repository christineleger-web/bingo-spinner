import React, { useEffect, useMemo, useRef, useState } from "react";

// ===== Bingo Spinner with Text-to-Speech =====
// How to use (quick):
// 1) Paste your word list (one item per line) into the textarea.
// 2) Click SPIN! The wheel will animate and the app will speak the selected item.
// 3) Toggle "Remove after spin" if you don't want repeats. Use "Reset" to restore.
// 4) (Optional) Choose voice, rate, and volume. Use the test button to preview.
// 5) Use the Fullscreen button for classroom display.

export default function BingoSpinner() {
  // Default list (example) — replace with your own. One per line.
  const defaultWords = `B1\nB2\nB3\nB4\nB5\nI16\nI17\nI18\nI19\nI20\nN31\nN32\nN33\nN34\nN35\nG46\nG47\nG48\nG49\nG50\nO61\nO62\nO63\nO64\nO65`;

  const [rawList, setRawList] = useState(defaultWords);
  const [items, setItems] = useState(() =>
    defaultWords
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const [history, setHistory] = useState<string[]>([]);
  const [removeOnPick, setRemoveOnPick] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0); // cumulative degrees
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const [spinCount, setSpinCount] = useState(0);

  // Speech synthesis state
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);

  // Load voices
  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      if (!voiceURI && v.length) {
        // Prefer an English voice fallback if available
        const en = v.find((vv) => (vv.lang || "").toLowerCase().startsWith("en"));
        setVoiceURI(en?.voiceURI || v[0].voiceURI);
      }
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [voiceURI]);

  // Derived slice angle
  const sliceAngle = items.length > 0 ? 360 / items.length : 0;

  // Build color palette (alternating shades for readability)
  const colors = useMemo(() => {
    const base = ["#e5e7eb", "#c7d2fe", "#fde68a", "#a7f3d0", "#fecaca", "#fbcfe8", "#bfdbfe", "#ddd6fe"]; // neutral/pastel
    return Array.from({ length: items.length }, (_, i) => base[i % base.length]);
  }, [items.length]);

  // Parse list when user clicks "Apply list"
  function applyList() {
    const list = rawList
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length > 0) {
      setItems(list);
      setHistory([]);
      setSelectedIndex(null);
      setRotation(0);
      setSpinCount(0);
    }
  }

  function resetList() {
    setItems(
      rawList
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
    setHistory([]);
    setSelectedIndex(null);
    setRotation(0);
    setSpinCount(0);
  }

  // Generate classic 1-75 BINGO list
  function setClassicBingo() {
    const letters = ["B", "I", "N", "G", "O"];
    const ranges = [
      [1, 15],
      [16, 30],
      [31, 45],
      [46, 60],
      [61, 75],
    ];
    const out: string[] = [];
    for (let i = 0; i < 5; i++) {
      const [a, b] = ranges[i];
      for (let n = a; n <= b; n++) out.push(`${letters[i]}${n}`);
    }
    const text = out.join("\n");
    setRawList(text);
    setItems(out);
    setHistory([]);
    setSelectedIndex(null);
    setRotation(0);
    setSpinCount(0);
  }

  // Speak helper
  function speak(text: string) {
    try {
      window.speechSynthesis.cancel(); // stop any current speech
      const u = new SpeechSynthesisUtterance(text);
      const v = voices.find((vv) => vv.voiceURI === voiceURI);
      if (v) u.voice = v;
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error("Speech error", e);
    }
  }

  function handleSpin() {
    if (items.length === 0 || isSpinning) return;
    const idx = Math.floor(Math.random() * items.length);
    setSelectedIndex(idx);

    // Compute target rotation so the chosen slice centers at top (12 o'clock)
    const centerAngle = idx * sliceAngle + sliceAngle / 2; // degrees from 0 (points to the right before SVG offset)
    // We want the chosen slice's center to land at visual 12 o'clock. We rotate the SVG -90° elsewhere,
    // so aligning to 0° here corresponds to the top on screen.
    const extraSpins = 6 + Math.floor(Math.random() * 4); // 6–9 spins for flair
    const current = ((rotation % 360) + 360) % 360; // normalize to [0, 360)
    const deltaToZero = (360 - ((centerAngle + current) % 360)) % 360; // shortest forward turn to 0°
    const target = rotation + extraSpins * 360 + deltaToZero;

    setIsSpinning(true);
    setSpinCount((c) => c + 1);
    setRotation(target);

    // Duration matches CSS transition below (ms)
    const duration = 4500; // 4.5s
    window.setTimeout(() => {
      setIsSpinning(false);
      const picked = items[idx];
      setHistory((h) => [picked, ...h]);
      if (autoSpeak) speak(picked);
      if (removeOnPick) {
        setItems((prev) => prev.filter((_, i) => i !== idx));
      }
    }, 4500);
  }

  function speakAgain() {
    if (history[0]) speak(history[0]);
  }

  // Build SVG slices
  const slices = useMemo(() => {
    const elements: JSX.Element[] = [];
    const radius = 200;
    let startAngle = 0;
    for (let i = 0; i < items.length; i++) {
      const endAngle = startAngle + sliceAngle;
      const largeArc = sliceAngle > 180 ? 1 : 0;
      // Convert polar to Cartesian
      const sx = radius * Math.cos((Math.PI / 180) * startAngle);
      const sy = radius * Math.sin((Math.PI / 180) * startAngle);
      const ex = radius * Math.cos((Math.PI / 180) * endAngle);
      const ey = radius * Math.sin((Math.PI / 180) * endAngle);

      const d = `M 0 0 L ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey} Z`;

      // Label position (mid angle)
      const mid = (startAngle + endAngle) / 2;
      const lx = (radius * 0.65) * Math.cos((Math.PI / 180) * mid);
      const ly = (radius * 0.65) * Math.sin((Math.PI / 180) * mid);

      elements.push(
        <g key={i}>
          <path d={d} fill={colors[i]} stroke="#ffffff" strokeWidth={2} />
          <text
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: items.length > 24 ? 10 : items.length > 16 ? 12 : 14,
              fontWeight: 700,
              userSelect: "none",
            }}
            transform={`rotate(${mid}, ${lx}, ${ly})`}
          >
            {items[i]}
          </text>
        </g>
      );

      startAngle = endAngle;
    }
    return elements;
  }, [items, sliceAngle, colors]);

  // Fullscreen support
  function goFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Wheel */}
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6 flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between gap-2 mb-4">
            <h1 className="text-xl sm:text-2xl font-bold">Bingo Spinner (TTS)</h1>
            <div className="flex gap-2">
              <button onClick={goFullscreen} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold">Fullscreen</button>
              <button onClick={resetList} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold">Reset</button>
            </div>
          </div>

          <div className="relative mt-2 mb-6">
            {/* Pointer */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20">
              <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent border-b-rose-500 drop-shadow" />
            </div>

            {/* Wheel */}
            <div
              ref={wheelRef}
              className="rounded-full border-4 border-white shadow-xl bg-gray-200"
              style={{
                width: 460,
                height: 460,
                transition: isSpinning ? "transform 4.5s cubic-bezier(0.12, 0.6, 0, 1)" : "none",
                transform: `rotate(${rotation}deg)`
              }}
            >
              <svg
                width={460}
                height={460}
                viewBox="-230 -230 460 460"
                className="rounded-full"
              >
                {items.length === 0 ? (
                  <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 20, fontWeight: 700 }}>
                    Add items to spin
                  </text>
                ) : (
                  <g transform="rotate(-90)">{slices}</g>
                )}
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleSpin}
              disabled={items.length === 0 || isSpinning}
              className={`px-6 py-3 rounded-2xl text-lg font-bold shadow ${
                isSpinning || items.length === 0
                  ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              {isSpinning ? "Spinning…" : "SPIN"}
            </button>
            <button
              onClick={speakAgain}
              disabled={!history[0]}
              className={`px-4 py-2 rounded-2xl font-semibold shadow ${
                history[0] ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-300 text-gray-600"
              }`}
            >
              Speak again
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="w-4 h-4" checked={removeOnPick} onChange={(e) => setRemoveOnPick(e.target.checked)} />
              Remove after spin
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="w-4 h-4" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
              Auto-speak
            </label>
          </div>

          {/* Current & History */}
          <div className="mt-6 w-full">
            <div className="bg-gray-100 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Last pick</div>
                <div className="text-2xl font-extrabold tracking-wide">{history[0] || "—"}</div>
              </div>
              <div className="text-sm text-gray-500">Spins: {spinCount}</div>
            </div>
            {history.length > 1 && (
              <div className="mt-3 text-sm text-gray-700 flex flex-wrap gap-2">
                {history.slice(1, 20).map((h, i) => (
                  <span key={i} className="px-2 py-1 bg-white rounded-lg border">{h}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="bg-white rounded-2xl shadow p-4 sm:p-6">
          <h2 className="text-lg font-bold mb-3">Your List</h2>
          <textarea
            className="w-full h-56 p-3 border rounded-xl font-mono text-sm"
            value={rawList}
            onChange={(e) => setRawList(e.target.value)}
            placeholder="One item per line (e.g., B1, B2, … or words like: pomme, banane, cerise)"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={applyList} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">Apply list</button>
            <button onClick={setClassicBingo} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-semibold">Classic 1–75 Bingo</button>
          </div>

          <h2 className="text-lg font-bold mt-6 mb-3">Voice Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="mb-1 font-medium">Voice</div>
              <select
                className="w-full border rounded-xl p-2"
                value={voiceURI}
                onChange={(e) => setVoiceURI(e.target.value)}
              >
                {voices.map((v, i) => (
                  <option key={i} value={v.voiceURI}>{`${v.name} (${v.lang})`}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                onClick={() => speak("Test de la voix. Voice test. Bonjour! Hello!")}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Test voice
              </button>
            </div>
            <label className="text-sm">
              <div className="flex justify-between mb-1"><span className="font-medium">Rate</span><span>{rate.toFixed(2)}</span></div>
              <input type="range" min={0.5} max={1.5} step={0.05} value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="w-full" />
            </label>
            <label className="text-sm">
              <div className="flex justify-between mb-1"><span className="font-medium">Pitch</span><span>{pitch.toFixed(2)}</span></div>
              <input type="range" min={0.5} max={2} step={0.05} value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} className="w-full" />
            </label>
            <label className="text-sm">
              <div className="flex justify-between mb-1"><span className="font-medium">Volume</span><span>{volume.toFixed(2)}</span></div>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full" />
            </label>
          </div>

          <h2 className="text-lg font-bold mt-6 mb-2">Tips</h2>
          <ul className="list-disc pl-5 text-sm space-y-1 text-gray-700">
            <li>Paste French or English words — the voice will read them. Choose a French voice for better French pronunciation.</li>
            <li>Turn on <span className="font-semibold">Remove after spin</span> to avoid repeats. Use <span className="font-semibold">Reset</span> anytime.</li>
            <li>Use <span className="font-semibold">Fullscreen</span> for the projector/board.</li>
            <li>If the browser blocks audio, click anywhere on the page once to allow sound.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
