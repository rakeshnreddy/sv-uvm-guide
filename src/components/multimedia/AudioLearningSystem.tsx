import React, { useState, useEffect, useRef } from "react";
import { recordEvent, AnalyticsEvent } from "@/lib/analytics";

interface AudioTrack {
  id: string;
  title: string;
  src: string;
  transcript: string;
  description?: string;
}

interface Flashcard {
  question: string;
  answer: string;
}

const samplePlaylist: AudioTrack[] = [
  {
    id: "sample",
    title: "Sample Audio",
    src: "/audio/sample.mp3",
    transcript: "Sample transcript for demo purposes.",
  },
];

const sampleFlashcards: Flashcard[] = [
  {
    question: "What is the topic of the sample audio?",
    answer: "Sample transcript for demo purposes.",
  },
];

const AudioLearningSystem: React.FC = () => {
  const [playlist, setPlaylist] = useState<AudioTrack[]>(samplePlaylist);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [search, setSearch] = useState("");
  const [flashcards, setFlashcards] = useState<Flashcard[]>(sampleFlashcards);
  const [currentCard, setCurrentCard] = useState(0);
  const [history, setHistory] = useState<AnalyticsEvent[]>([]);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [assessment, setAssessment] = useState<Blob | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);

  // Initialize AudioContext with noise reduction filter
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    setAudioCtx(ctx);
    return () => {
      void ctx.close();
    };
  }, []);

  useEffect(() => {
    if (!audioCtx || !audioRef.current) return;
    const source = audioCtx.createMediaElementSource(audioRef.current);
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1000;
    source.connect(filter).connect(audioCtx.destination);
  }, [audioCtx]);

  // Track completion analytics
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setIsPlaying(false);
      if (startTime) {
        const duration = (Date.now() - startTime) / 1000;
        setHistory(h => recordEvent(h, { type: "interaction", value: duration, timestamp: Date.now() }));
      }
      setHistory(h => recordEvent(h, { type: "interaction", value: 1, timestamp: Date.now() }));
    };
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("ended", onEnded);
    };
  }, [startTime, currentTrack]);

  const filteredTracks = playlist.filter(
    t =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.transcript.toLowerCase().includes(search.toLowerCase()),
  );

  const play = () => {
    if (!audioRef.current) return;
    audioRef.current.play();
    setIsPlaying(true);
    setStartTime(Date.now());
  };

  const pause = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
    if (startTime) {
      const duration = (Date.now() - startTime) / 1000;
      setHistory(h => recordEvent(h, { type: "interaction", value: duration, timestamp: Date.now() }));
    }
  };

  const changeSpeed = (rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setPlaybackRate(rate);
  };

  const cacheCurrentTrack = async () => {
    if (typeof caches === "undefined") return;
    const track = playlist[currentTrack];
    if (!track) return;
    const cache = await caches.open("audio-learning-cache");
    const res = await fetch(track.src);
    cache.put(track.src, res);
  };

  const startAssessment = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      setAssessment(new Blob(chunks, { type: "audio/webm" }));
      setHistory(h => recordEvent(h, { type: "assessment", value: 1, timestamp: Date.now() }));
    };
    recorder.start();
    setMediaRecorder(recorder);
  };

  const stopAssessment = () => {
    mediaRecorder?.stop();
    setMediaRecorder(null);
  };

  const submitFeedback = () => {
    setHistory(h => recordEvent(h, { type: "interaction", value: 1, timestamp: Date.now() }));
    setFeedback("");
  };

  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search audio..."
        className="w-full p-2 border rounded"
      />
      <ul className="space-y-1">
        {filteredTracks.map(track => (
          <li key={track.id}>
            <button
              onClick={() => setCurrentTrack(playlist.findIndex(t => t.id === track.id))}
              className="text-left w-full p-2 hover:bg-muted rounded"
            >
              {track.title}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <button onClick={play} disabled={isPlaying} className="px-2 py-1 border rounded">
          Play
        </button>
        <button onClick={pause} disabled={!isPlaying} className="px-2 py-1 border rounded">
          Pause
        </button>
        <select
          value={playbackRate}
          onChange={e => changeSpeed(Number(e.target.value))}
          className="border rounded p-1"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
        <button onClick={cacheCurrentTrack} className="px-2 py-1 border rounded">
          Save Offline
        </button>
      </div>
      <audio ref={audioRef} src={playlist[currentTrack]?.src} controls className="w-full" />
      <div>
        <h3 className="font-semibold">Transcript</h3>
        <p className="whitespace-pre-line text-sm">{playlist[currentTrack]?.transcript}</p>
      </div>
      <div className="border rounded p-4">
        <h3 className="font-semibold mb-2">Flashcards</h3>
        {flashcards.length > 0 && (
          <div>
            <p className="mb-2">{flashcards[currentCard].question}</p>
            <button
              onClick={() => setCurrentCard(c => (c + 1) % flashcards.length)}
              className="px-2 py-1 border rounded mr-2"
            >
              Next
            </button>
            <span className="text-muted-foreground text-sm">
              {flashcards[currentCard].answer}
            </span>
          </div>
        )}
      </div>
      <div className="border rounded p-4">
        <h3 className="font-semibold mb-2">Audio Assessment</h3>
        {mediaRecorder ? (
          <button onClick={stopAssessment} className="px-2 py-1 border rounded">
            Stop
          </button>
        ) : (
          <button onClick={startAssessment} className="px-2 py-1 border rounded">
            Record Response
          </button>
        )}
        {assessment && (
          <audio src={URL.createObjectURL(assessment)} controls className="mt-2 w-full" />
        )}
      </div>
      <div className="border rounded p-4">
        <h3 className="font-semibold mb-2">Feedback</h3>
        <textarea
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          className="w-full border rounded mb-2 p-2"
        />
        <button onClick={submitFeedback} className="px-2 py-1 border rounded">
          Submit Feedback
        </button>
      </div>
    </div>
  );
};

export default AudioLearningSystem;
