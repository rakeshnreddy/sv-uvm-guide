"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, Award } from "lucide-react";

const waveformSamples = [0, 1, 2, 3, 4, 5, 6];
const codeSnippet = String.raw`module up_counter (
  input  logic clk,
  input  logic rst_n,
  output logic [2:0] count
);

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      count <= 3'd0;
    end else if (count < 3'd7) begin
      count <= count + 3'd1;
    end else begin
      count <= 3'd0;
    end
  end

endmodule`;

const FirstBugHuntGame = () => {
  const [isBugFound, setBugFound] = useState(false);
  const [highlight, setHighlight] = useState<"spec" | "waveform" | "code" | null>(null);

  useEffect(() => {
    if (!isBugFound) return;
    const timer = setTimeout(() => setHighlight(null), 4000);
    return () => clearTimeout(timer);
  }, [isBugFound]);

  const triggerSuccess = (source: "spec" | "waveform" | "code") => {
    setHighlight(source);
    setBugFound(true);
  };

  return (
    <div className="relative grid gap-6 rounded-3xl border border-emerald-400/40 bg-slate-950/80 p-6 text-white shadow-xl lg:grid-cols-[1.2fr,1fr]">
      <div className="space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-300">
          Your First Mission, Should You Choose to Accept It...
        </h3>
        <p className="text-xl font-bold leading-tight text-white">Bug Hunt: Diagnose the Counter</p>
        <p className="text-sm text-slate-300">
          Our verification plan says the up-counter must count from 0 to 7 inclusive. The waveform below comes from the
          design under test. Something is off – can you spot it?
        </p>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Specification</p>
          <button
            type="button"
            onClick={() => triggerSuccess("spec")}
            className={`mt-2 w-full rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
              highlight === "spec" ? "border-emerald-400 bg-emerald-500/20" : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            The counter shall increment once per cycle and produce the sequence 0 → 1 → … → 7 before wrapping to 0.
          </button>
          <p className="mt-3 text-xs text-slate-400">
            Tip: Requirements are first-class citizens. If the hardware output violates the spec, you have found a bug.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Waveform Capture</p>
          <div className="mt-3 grid grid-cols-7 gap-2">
            {waveformSamples.concat([0]).map((value, index) => {
              const isFault = index === waveformSamples.length; // wrap happens too early
              return (
                <button
                  key={`sample-${index}`}
                  type="button"
                  onClick={() => triggerSuccess("waveform")}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl border text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                    isFault
                      ? "border-rose-400/70 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                      : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                  } ${highlight === "waveform" && isFault ? "ring-2 ring-rose-400" : ""}`}
                  aria-label={isFault ? "Wraps early at 6" : `Sample ${value}`}
                >
                  <span className="text-xs uppercase tracking-[0.2em]">Cycle {index}</span>
                  <span className="text-xl font-semibold">{value}</span>
                  {isFault && <span className="text-[10px] uppercase tracking-[0.2em]">Should be 7</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-3xl border border-emerald-400/30 bg-emerald-500/5 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">DUT Snippet</p>
          <pre className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-emerald-100">
            {codeSnippet}
          </pre>
          <button
            type="button"
            onClick={() => triggerSuccess("code")}
            className={`mt-3 w-full rounded-xl border px-4 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
              highlight === "code"
                ? "border-emerald-400 bg-emerald-500/20"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            🔍 Highlight the condition <code className="ml-1 rounded bg-black/50 px-1">count &lt; 3'd7</code>
          </button>
          <p className="mt-3 text-xs text-emerald-200/80">
            Engineers often write <code>count &lt; max</code> instead of <code>count &lt;= max</code>. Assertions and scoreboards
            make this mismatch obvious.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-slate-200">
          <p>
            <span className="font-semibold text-emerald-300">Mission:</span> Click the waveform glitch or the faulty
            condition. Score instant XP and claim your first badge.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isBugFound && (
          <motion.div
            className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl border border-emerald-400/50 bg-slate-950/90 p-6 text-center text-white shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                <Bug className="h-8 w-8" />
              </div>
              <h4 className="mt-4 text-2xl font-bold">Success!</h4>
              <p className="mt-2 text-sm text-slate-200">
                You spotted the off-by-one bug. The counter stops at 6 because the condition uses
                <code className="mx-1 rounded bg-black/60 px-1">&lt;</code> instead of
                <code className="mx-1 rounded bg-black/60 px-1">&lt;=</code>.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
                <Award className="h-6 w-6 text-amber-300" />
                <div className="text-left text-sm">
                  <p className="font-semibold text-white">Bug Hunter Badge Unlocked</p>
                  <p className="text-emerald-300">+100 XP</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBugFound(false)}
                className="mt-6 w-full rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              >
                Continue Exploring
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FirstBugHuntGame;
