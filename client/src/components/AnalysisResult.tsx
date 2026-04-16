import React, { useEffect } from "react";
import { useStore } from "../stores/useStore";

export default function AnalysisResult() {
  const { step, analysis, uploadedImage, setStep, setSchemes } = useStore();

  const handleRecommend = async () => {
    if (!analysis) return;
    setStep("recommending");

    try {
      const resp = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      const data = await resp.json();

      if (data.success) {
        setSchemes(data.schemes);
        setStep("recommend");
      } else {
        alert("Recommendation failed: " + (data.error || "Unknown"));
        setStep("analysis");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
      setStep("analysis");
    }
  };

  if (step === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h3 className="text-xl font-semibold text-slate-700 mb-2">
          AI 正在分析您的房间...
        </h3>
        <p className="text-slate-500">
          正在识别房间类型、风格、光线等信息
        </p>
      </div>
    );
  }

  if (!analysis) return null;

  const tags = [
    { label: "房间类型", value: analysis.room_type, color: "blue" },
    { label: "主风格", value: analysis.style, color: "purple" },
    { label: "光线", value: analysis.lighting, color: "amber" },
    { label: "色调", value: analysis.color_tone, color: "green" },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
        AI 分析结果
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Room preview */}
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <img
            src={uploadedImage || ""}
            alt="Room"
            className="w-full h-64 object-cover"
          />
        </div>

        {/* Analysis details */}
        <div className="space-y-4">
          {/* Tags */}
          <div className="flex flex-wrap gap-3">
            {tags.map((t) => (
              <div
                key={t.label}
                className="px-4 py-2 bg-slate-100 rounded-lg"
              >
                <span className="text-xs text-slate-500 block">
                  {t.label}
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {t.value}
                </span>
              </div>
            ))}
          </div>

          {/* Secondary styles */}
          {analysis.secondary_styles?.length > 0 && (
            <div>
              <span className="text-sm text-slate-500">兼容风格：</span>
              <div className="flex gap-2 mt-1">
                {analysis.secondary_styles.map((s) => (
                  <span
                    key={s}
                    className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Existing furniture */}
          {analysis.existing_furniture?.length > 0 && (
            <div>
              <span className="text-sm text-slate-500">
                已有家具：
              </span>
              <p className="text-sm text-slate-700 mt-1">
                {analysis.existing_furniture.join("、")}
              </p>
            </div>
          )}

          {/* Suggested categories */}
          {analysis.suggested_categories?.length > 0 && (
            <div>
              <span className="text-sm text-slate-500">
                建议品类：
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {analysis.suggested_categories.map((c) => (
                  <span
                    key={c}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Space features */}
          {analysis.space_features && (
            <div>
              <span className="text-sm text-slate-500">空间特点：</span>
              <p className="text-sm text-slate-700 mt-1">
                {analysis.space_features}
              </p>
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <span className="text-sm font-medium text-blue-800">
                搭配建议
              </span>
              <p className="text-sm text-blue-700 mt-1">
                {analysis.suggestions}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleRecommend}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          获取 AI 推荐方案
        </button>
      </div>
    </div>
  );
}
