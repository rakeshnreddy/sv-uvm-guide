"use client";

import dynamic from "next/dynamic";
import React from "react";

import { useServerFeature } from "@/lib/persistence/target";

// The button and the dialog live in a lazy chunk, so this gate is all the
// (learning) layout's client bundle carries. ssr:false costs nothing:
// useServerFeature is false on the server and until hydration.
const AIAssistantLauncher = dynamic(() => import("./AIAssistantLauncher"), {
  ssr: false,
  loading: () => null,
});

/**
 * The gate for the floating AI tutor. The tutor needs a server secret and a
 * per-learner rate limit, so this renders nothing, loads no launcher chunk and
 * never requests /api/ai/* unless the AI tutor is on and a learner is signed
 * in. The (learning) layout also mounts it only when SITE_FEATURES.aiTutor is on.
 */
export default function AIAssistantWidget() {
  const enabled = useServerFeature("aiTutor");

  if (!enabled) {
    return null;
  }

  return <AIAssistantLauncher />;
}
