"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import { AnalyticsEvent, recordEvent } from '../../lib/analytics';

interface Video {
  id: string;
  title: string;
  src: string;
  transcript?: string;
  captions?: string;
  metadata?: {
    tags?: string[];
    [key: string]: unknown;
  };
}

interface VideoLearningCenterProps {
  playlist: Video[];
  onRecordEvent?: (events: AnalyticsEvent[]) => void;
  onQuizStart?: (video: Video) => void;
  onQuizComplete?: (video: Video, score: number) => void;
}

// Parse "[mm:ss] text" formatted transcripts into chapter markers
const parseTranscript = (transcript: string) =>
  transcript
    .split('\n')
    .map(line => {
      const match = line.match(/\[(\d{2}):(\d{2})\]\s*(.*)/);
      if (!match) return null;
      const [, mm, ss, text] = match;
      const time = parseInt(mm, 10) * 60 + parseInt(ss, 10);
      return { time, text };
    })
    .filter(Boolean) as { time: number; text: string }[];

export const VideoLearningCenter: React.FC<VideoLearningCenterProps> = ({
  playlist,
  onRecordEvent,
  onQuizStart,
  onQuizComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  const currentVideo = playlist[currentIndex];
  const chapters = currentVideo.transcript
    ? parseTranscript(currentVideo.transcript)
    : [];

  // Keyboard navigation for playlist
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      setCurrentIndex(i => (i + 1) % playlist.length);
    } else if (e.key === 'ArrowLeft') {
      setCurrentIndex(i => (i - 1 + playlist.length) % playlist.length);
    }
  };

  // Caption toggling
  const toggleCaptions = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const tracks = videoEl.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = captionsEnabled ? 'disabled' : 'showing';
    }
    setCaptionsEnabled(!captionsEnabled);
  };

  // Analytics recording helper
  const record = useCallback(
    (event: AnalyticsEvent) => {
      setEvents(prev => {
        const updated = recordEvent(prev, event);
        onRecordEvent?.(updated);
        return updated;
      });
    },
    [onRecordEvent]
  );

  useEffect(() => {
    record({ type: 'interaction', value: currentIndex, timestamp: Date.now() });
  }, [currentIndex, record]);

  // Quiz integration hooks
  const startQuiz = () => {
    onQuizStart?.(currentVideo);
    record({ type: 'interaction', value: 1, timestamp: Date.now() });
  };

  const completeQuiz = (score: number) => {
    onQuizComplete?.(currentVideo, score);
    record({ type: 'assessment', value: score, timestamp: Date.now() });
  };

  // Context-aware recommendation method
  const recommendVideos = useCallback(
    (context: { tags?: string[] }) => {
      if (!context.tags) return playlist;
      return playlist.filter(v =>
        v.metadata?.tags?.some(tag => context.tags?.includes(tag)),
      );
    },
    [playlist],
  );

  const recommendations = recommendVideos({
    tags: currentVideo.metadata?.tags,
  }).filter(v => v.id !== currentVideo.id);

  return (
    <div
      className="flex flex-col md:flex-row gap-4 w-full"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Video learning center"
    >
      <div className="w-full md:w-3/4">
        <video
          ref={videoRef}
          key={currentVideo.id}
          controls
          className="w-full h-auto rounded"
          aria-label={currentVideo.title}
        >
          <source src={currentVideo.src} />
          {currentVideo.captions && (
            <track
              src={currentVideo.captions}
              kind="subtitles"
              label="English"
              default={captionsEnabled}
            />
          )}
        </video>
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={toggleCaptions}
            className="text-sm underline"
            aria-pressed={captionsEnabled}
          >
            {captionsEnabled ? 'Disable' : 'Enable'} Captions
          </button>
          {onQuizStart && (
            <button onClick={startQuiz} className="text-sm underline">
              Take Quiz
            </button>
          )}
          {onQuizComplete && (
            <button
              onClick={() => completeQuiz(1)}
              className="text-sm underline"
            >
              Submit Quiz
            </button>
          )}
        </div>
        {chapters.length > 0 && (
          <ol className="mt-4 text-sm space-y-1" aria-label="Chapter markers">
            {chapters.map(chapter => (
              <li key={chapter.time}>
                <button
                  className="hover:underline"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = chapter.time;
                      videoRef.current.focus();
                    }
                  }}
                >
                  {new Date(chapter.time * 1000)
                    .toISOString()
                    .substr(14, 5)}{' '}
                  - {chapter.text}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="w-full md:w-1/4">
        <ul className="space-y-2" aria-label="Video playlist">
          {playlist.map((video, i) => (
            <li key={video.id}>
              <button
                className={`text-left w-full ${
                  i === currentIndex ? 'font-bold' : ''
                }`}
                onClick={() => setCurrentIndex(i)}
              >
                {video.title}
              </button>
            </li>
          ))}
        </ul>
        {recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold text-sm">Recommended</h4>
            <ul className="space-y-1" aria-label="Recommended videos">
              {recommendations.map(video => (
                <li key={video.id}>
                  <button
                    className="underline text-left"
                    onClick={() => setCurrentIndex(playlist.indexOf(video))}
                  >
                    {video.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export const recommendVideoByContext = (
  playlist: Video[],
  context: { tags?: string[] },
): Video[] => {
  if (!context.tags) return playlist;
  return playlist.filter(video =>
    context.tags?.some(tag => video.metadata?.tags?.includes(tag)),
  );
};

export default VideoLearningCenter;
