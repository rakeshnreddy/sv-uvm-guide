"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type SceneId = "dynamic-array" | "queue" | "associative" | "packed-matrix";

const DEFAULT_SCENE: SceneId = "dynamic-array";
const VALID_SCENES: SceneId[] = [
  "dynamic-array",
  "queue",
  "associative",
  "packed-matrix",
];

const isSceneId = (value: unknown): value is SceneId =>
  typeof value === "string" && (VALID_SCENES as readonly string[]).includes(value);

type SearchParamsValue = ReturnType<typeof useSearchParams>;

const getInitialScene = (
  preferred: SceneId | undefined,
  searchParams: SearchParamsValue | null,
): SceneId => {
  if (preferred && isSceneId(preferred)) {
    return preferred;
  }

  const queryScene = searchParams?.get("scene");
  if (queryScene && isSceneId(queryScene)) {
    return queryScene;
  }

  return DEFAULT_SCENE;
};

const buildIframeSrc = (initialScene: SceneId): string => {
  const params = new URLSearchParams();
  if (initialScene !== DEFAULT_SCENE) {
    params.set("scene", initialScene);
  }
  const query = params.toString();
  return `/visualizations/systemverilog-3d.html${query ? `?${query}` : ""}`;
};

export interface SystemVerilog3DVisualizerProps {
  initialScene?: SceneId;
  className?: string;
  height?: number | string;
}

const SystemVerilog3DVisualizer: React.FC<SystemVerilog3DVisualizerProps> = ({
  initialScene,
  className,
  height = "720px",
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [scene, setScene] = useState<SceneId>(() =>
    getInitialScene(initialScene, searchParams),
  );
  const initialIframeScene = useRef<SceneId>(scene);

  const iframeSrc = useMemo(
    () => buildIframeSrc(initialIframeScene.current),
    [],
  );

  useEffect(() => {
    const queryScene = getInitialScene(initialScene, searchParams ?? null);
    setScene((current) => (current === queryScene ? current : queryScene));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, initialScene]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentParam = searchParams?.get("scene") ?? null;
    const shouldPersistParam = scene !== DEFAULT_SCENE;
    if (shouldPersistParam && currentParam === scene) return;
    if (!shouldPersistParam && currentParam === null) return;

    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
    if (shouldPersistParam) {
      nextParams.set("scene", scene);
    } else {
      nextParams.delete("scene");
    }

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    const navigationMethod = shouldPersistParam ? router.push : router.replace;
    if (typeof navigationMethod === "function") {
      navigationMethod(nextUrl, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, searchParams]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "sv3d:mode-change" && isSceneId(event.data.scene)) {
        setScene(event.data.scene);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => setIframeReady(true);
    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, []);

  useEffect(() => {
    if (!iframeReady) return;
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return;

    iframeWindow.postMessage(
      {
        type: "sv3d:set-mode",
        scene,
      },
      window.location.origin,
    );
  }, [scene, iframeReady]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-border/60 bg-black",
        className,
      )}
      style={{ height }}
      data-testid="sv-3d-visualizer"
      data-variant="full"
      data-active-scene={scene}
      data-initial-scene={initialIframeScene.current}
    >
      <iframe
        ref={iframeRef}
        title="SystemVerilog 3D Explorer"
        src={iframeSrc}
        className="h-full w-full border-0"
        allow="fullscreen"
      />
    </div>
  );
};

export default SystemVerilog3DVisualizer;
