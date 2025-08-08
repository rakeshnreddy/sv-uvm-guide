"use client";

import React, { useState, useMemo } from 'react';
import AnalyticsDashboard from "../analytics/AnalyticsDashboard";
import {
  AnalyticsEvent,
  recordEvent,
  computeEngagement,
  predictPerformance,
} from "../../lib/analytics";

type Role = "viewer" | "editor" | "admin";

interface Asset {
  id: string;
  title: string;
  url: string;
  version: string;
  quality?: number;
  feedback?: string;
}

interface MultimediaContentManagerProps {
  initialAssets?: Asset[];
  userRole: Role;
  locale?: "en" | "es";
}

const translations = {
  en: {
    assets: "Assets",
    version: "Version",
    quality: "Quality",
    feedback: "Feedback",
    recommendations: "Recommendations",
    export: "Export",
    addAsset: "Add Asset",
    analytics: "Analytics",
  },
  es: {
    assets: "Recursos",
    version: "Versión",
    quality: "Calidad",
    feedback: "Comentarios",
    recommendations: "Recomendaciones",
    export: "Exportar",
    addAsset: "Agregar Recurso",
    analytics: "Analíticas",
  },
};

function useTranslation(locale: "en" | "es") {
  return (key: keyof typeof translations["en"]) =>
    translations[locale][key] || key;
}

export const MultimediaContentManager: React.FC<MultimediaContentManagerProps> = ({
  initialAssets = [],
  userRole,
  locale = "en",
}) => {
  const t = useTranslation(locale);
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [newAssetTitle, setNewAssetTitle] = useState("");
  const [newAssetUrl, setNewAssetUrl] = useState("");
  const commitRef =
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_COMMIT_SHA ||
    "dev";

  const canEdit = userRole === "editor" || userRole === "admin";

  const addEvent = (e: AnalyticsEvent) =>
    setEvents(prev => recordEvent(prev, e));

  const addAsset = () => {
    if (!newAssetTitle) return;
    const asset: Asset = {
      id: Date.now().toString(),
      title: newAssetTitle,
      url: newAssetUrl,
      version: commitRef,
    };
    setAssets(prev => [...prev, asset]);
    setNewAssetTitle("");
    setNewAssetUrl("");
    addEvent({ type: "interaction", value: 1, timestamp: Date.now() });
  };

  const updateQuality = (
    id: string,
    quality: number,
    feedback: string,
  ) => {
    setAssets(prev =>
      prev.map(a => (a.id === id ? { ...a, quality, feedback } : a)),
    );
    addEvent({ type: "assessment", value: quality, timestamp: Date.now() });
  };

  const engagement = computeEngagement(events);
  const predicted = predictPerformance(events);

  const recommended = useMemo(() => {
    return [...assets].sort(
      (a, b) => (b.quality || 0) - (a.quality || 0) + predicted,
    );
  }, [assets, predicted]);

  const exportAssets = () => {
    const data = JSON.stringify(assets, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "assets.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <section>
        <h3 className="font-semibold">{t("analytics")}</h3>
        <AnalyticsDashboard events={events} />
      </section>

      <section>
        <h3 className="font-semibold">{t("assets")}</h3>
        {canEdit && (
          <div className="flex gap-2 mb-4">
            <input
              className="border p-1 flex-1"
              placeholder={t("addAsset")}
              value={newAssetTitle}
              onChange={e => setNewAssetTitle(e.target.value)}
            />
            <input
              className="border p-1 flex-1"
              placeholder="URL"
              value={newAssetUrl}
              onChange={e => setNewAssetUrl(e.target.value)}
            />
            <button className="border px-2" onClick={addAsset}>
              {t("addAsset")}
            </button>
          </div>
        )}
        <ul className="space-y-2">
          {assets.map(asset => (
            <li key={asset.id} className="border p-2 rounded">
              <div className="flex justify-between">
                <a href={asset.url} className="font-medium underline">
                  {asset.title}
                </a>
                <span className="text-xs text-gray-500">
                  {t("version")}: {asset.version}
                </span>
              </div>

              {canEdit && (
                <div className="mt-2 space-y-1">
                  <label className="block text-sm">
                    {t("quality")}
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={asset.quality ?? ""}
                      onChange={e =>
                        updateQuality(
                          asset.id,
                          Number(e.target.value),
                          asset.feedback || "",
                        )
                      }
                      className="border ml-2 p-1 w-16"
                    />
                  </label>
                  <textarea
                    className="border p-1 w-full"
                    placeholder={t("feedback")}
                    value={asset.feedback ?? ""}
                    onChange={e =>
                      updateQuality(
                        asset.id,
                        asset.quality || 0,
                        e.target.value,
                      )
                    }
                  />
                </div>
              )}

              {!canEdit && asset.feedback && (
                <p className="text-sm mt-1">{asset.feedback}</p>
              )}
            </li>
          ))}
        </ul>

        {userRole === "admin" && (
          <button className="mt-2 border px-2" onClick={exportAssets}>
            {t("export")}
          </button>
        )}
      </section>

      <section>
        <h3 className="font-semibold">{t("recommendations")}</h3>
        <ul className="list-disc ml-5">
          {recommended.map(a => (
            <li key={a.id}>{a.title}</li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          {t("quality")} / {t("feedback")} events: {engagement}
        </p>
      </section>
    </div>
  );
};

export default MultimediaContentManager;
