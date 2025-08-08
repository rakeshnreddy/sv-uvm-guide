"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';

interface Task {
  id: string;
  title: string;
  owner: string;
  status: 'todo' | 'in-progress' | 'done';
}

interface Stakeholder {
  id: string;
  name: string;
  role: string;
}

interface QAItem {
  id: string;
  description: string;
  done: boolean;
}

const mockTasks: Task[] = [
  { id: 't1', title: 'Setup simulation environment', owner: 'Alice', status: 'in-progress' },
  { id: 't2', title: 'Implement UVM agents', owner: 'Bob', status: 'todo' },
  { id: 't3', title: 'Run regression suite', owner: 'Carol', status: 'done' },
];

const mockStakeholders: Stakeholder[] = [
  { id: 's1', name: 'Design Lead', role: 'Approver' },
  { id: 's2', name: 'Verification Lead', role: 'Reviewer' },
];

const mockQA: QAItem[] = [
  { id: 'q1', description: 'Lint clean', done: true },
  { id: 'q2', description: 'Coverage above 95%', done: false },
];

export const ImmersiveLabEnvironment = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [progress, setProgress] = useState(0);
  const [xrSupported, setXrSupported] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = canvasRef.current;
    if (canvas) {
      const gl = canvas.getContext('webgl');
      if (gl) {
        gl.clearColor(0.1, 0.1, 0.1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }
    if ((navigator as any).xr) {
      (navigator as any).xr
        .isSessionSupported('immersive-vr')
        .then((supported: boolean) => setXrSupported(supported))
        .catch(() => setXrSupported(false));
    }
  }, []);

  const initWebRTC = async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await pc.setRemoteDescription(offer);
    } catch (err) {
      console.error('WebRTC init error', err);
    }
  };

  useEffect(() => {
    initWebRTC();
    // Cleanup not necessary for demo
  }, []);

  const startXrSession = async () => {
    try {
      const session = await (navigator as any).xr.requestSession('immersive-vr');
      console.log('XR session started', session);
    } catch (err) {
      console.error('XR session failed', err);
    }
  };

  const advanceProgress = () => setProgress((p) => Math.min(100, p + 10));

  return (
    <div className="flex flex-col md:flex-row w-full h-full gap-4" aria-label="Immersive lab environment">
      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-64 md:h-full rounded-md bg-black"
          aria-label="3D lab canvas"
        />
        {xrSupported && (
          <Button className="absolute top-2 left-2" onClick={startXrSession} aria-label="Enter XR mode">
            Enter XR
          </Button>
        )}
      </div>
      <div className="flex flex-col flex-1 space-y-4 overflow-auto">
        <section aria-labelledby="tools-heading" className="p-4 bg-white/5 rounded-lg">
          <h2 id="tools-heading" className="text-lg font-semibold text-primary">
            Virtual Tools
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {['Oscilloscope', 'Logic Analyzer', 'Waveform Viewer'].map((tool) => (
              <Button key={tool} variant="secondary" className="text-sm">
                {tool}
              </Button>
            ))}
          </div>
        </section>
        <section aria-labelledby="collab-heading" className="p-4 bg-white/5 rounded-lg">
          <h2 id="collab-heading" className="text-lg font-semibold text-primary">
            Collaboration
          </h2>
          <div className="flex flex-col md:flex-row gap-2">
            <video
              ref={localVideoRef}
              className="w-full md:w-1/2 rounded"
              autoPlay
              muted
              playsInline
              aria-label="Local video"
            />
            <video
              ref={remoteVideoRef}
              className="w-full md:w-1/2 rounded"
              autoPlay
              playsInline
              aria-label="Remote video"
            />
          </div>
        </section>
        <section aria-labelledby="project-heading" className="p-4 bg-white/5 rounded-lg">
          <h2 id="project-heading" className="text-lg font-semibold text-primary">
            Project Management
          </h2>
          <ul className="text-sm list-disc pl-5">
            {mockTasks.map((task) => (
              <li key={task.id} className="flex justify-between">
                <span>
                  {task.title} - {task.owner}
                </span>
                <span className="text-muted-foreground">{task.status}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <h3 className="text-md font-medium">Stakeholders</h3>
            <ul className="text-sm list-disc pl-5">
              {mockStakeholders.map((s) => (
                <li key={s.id}>
                  {s.name} - {s.role}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4">
            <h3 className="text-md font-medium">QA Checks</h3>
            <ul className="text-sm list-disc pl-5">
              {mockQA.map((q) => (
                <li key={q.id}>{q.description}</li>
              ))}
            </ul>
          </div>
        </section>
        <section aria-labelledby="cert-heading" className="p-4 bg-white/5 rounded-lg">
          <h2 id="cert-heading" className="text-lg font-semibold text-primary">
            Certification Prep
          </h2>
          <p className="text-sm text-muted-foreground">Earn badges as you complete modules.</p>
          <Progress value={progress} className="mt-2" />
          <Button className="mt-2" onClick={advanceProgress} aria-label="Complete module">
            Complete Module
          </Button>
        </section>
      </div>
    </div>
  );
};

export default ImmersiveLabEnvironment;

