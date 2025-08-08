"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type ColorContrast = "normal" | "high";

export interface AccessibilitySettings {
  screenReader: boolean;
  captions: boolean;
  transcripts: boolean;
  altText: boolean;
  signLanguage: boolean;
  keyboardNavigation: boolean;
  colorContrast: ColorContrast;
  textToSpeech: boolean;
  cognitive: boolean;
  mobility: boolean;
}

const defaultSettings: AccessibilitySettings = {
  screenReader: false,
  captions: false,
  transcripts: false,
  altText: true,
  signLanguage: false,
  keyboardNavigation: true,
  colorContrast: "normal",
  textToSpeech: false,
  cognitive: false,
  mobility: false,
};

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  toggleCaptions: () => void;
  toggleTranscripts: () => void;
  toggleScreenReader: () => void;
  generateAltText: (description: string) => string;
  attachSignLanguage: (video: HTMLVideoElement, src: string) => void;
  toggleKeyboardNavigation: () => void;
  setColorContrast: (level: ColorContrast) => void;
  speak: (text: string) => void;
  setCognitive: (enabled: boolean) => void;
  setMobility: (enabled: boolean) => void;
  getAriaProps: (
    label: string,
    role?: string,
    options?: { describedby?: string }
  ) => React.AriaAttributes & { role?: string };
}

const AccessibilityContext =
  createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityEnhancer = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [settings, setSettings] =
    useState<AccessibilitySettings>(defaultSettings);

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("accessibility-settings")
        : null;
    if (stored) {
      setSettings(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "accessibility-settings",
        JSON.stringify(settings)
      );
    }
  }, [settings]);

  const toggle = useCallback(
    (key: keyof AccessibilitySettings) =>
      setSettings(prev => ({ ...prev, [key]: !prev[key] })),
    []
  );

  const toggleCaptions = () => toggle("captions");
  const toggleTranscripts = () => toggle("transcripts");
  const toggleScreenReader = () => toggle("screenReader");
  const toggleKeyboardNavigation = () => toggle("keyboardNavigation");

  const setColorContrast = (level: ColorContrast) =>
    setSettings(prev => ({ ...prev, colorContrast: level }));

  const setCognitive = (enabled: boolean) =>
    setSettings(prev => ({ ...prev, cognitive: enabled }));

  const setMobility = (enabled: boolean) =>
    setSettings(prev => ({ ...prev, mobility: enabled }));

  const generateAltText = (description: string) =>
    `Image describing ${description}`;

  const attachSignLanguage = (
    video: HTMLVideoElement,
    src: string
  ) => {
    const track = document.createElement("track");
    track.kind = "sign";
    track.src = src;
    video.appendChild(track);
  };

  const speak = (text: string) => {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (synth) {
      const utterance = new SpeechSynthesisUtterance(text);
      synth.speak(utterance);
    }
  };

  const getAriaProps = (
    label: string,
    role?: string,
    options?: { describedby?: string }
  ) => {
    const props: React.AriaAttributes & { role?: string } = {
      "aria-label": label,
    };
    if (role) props.role = role;
    if (options?.describedby) {
      props["aria-describedby"] = options.describedby;
    }
    if (settings.screenReader) {
      props["aria-live"] = "polite";
    }
    return props;
  };

  const value: AccessibilityContextType = {
    settings,
    toggleCaptions,
    toggleTranscripts,
    toggleScreenReader,
    generateAltText,
    attachSignLanguage,
    toggleKeyboardNavigation,
    setColorContrast,
    speak,
    setCognitive,
    setMobility,
    getAriaProps,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error(
      "useAccessibility must be used within AccessibilityEnhancer"
    );
  }
  return context;
};

