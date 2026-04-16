import React from "react";
import { useStore } from "../stores/useStore";

export default function RefinePanel() {
  const { step, refineResult, setStep } = useStore();

  if (step === "refining") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h3 className="text-xl font-semibold text-slate-700 mb-2">
          AI 正在精修场景图...
        </h3>
        <p className="text-slate-500">
          优化光影、融合效果，生成更真实的场景图
        </p>

        {/* Show original canvas image if available */}
        {refineResult?.canvasImage && (
          <div className="mt-8 rounded-xl overflow-hidden border border-slate-200 shadow-md max-w-2xl">
            <img
              src={refineResult.canvasImage}
              alt="Original canvas"
              className="w-full"
            />
          </div>
        )}
      </div>
    );
  }

  if (!refineResult) return null;

  const downloadImage = (dataUrl: string, name: string) => {
    const link = document.createElement("a");
    link.download = name;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
        AI 精修结果
      </h2>

      {/* Refined image mode */}
      {refineResult.mode === "refined" && (
        <div className="space-y-6">
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-lg">
            <img
              src={refineResult.refinedImage}
              alt="Refined"
              className="w-full"
            />
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-green-800 font-medium">
              {refineResult.message}
            </p>
          </div>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setStep("canvas")}
              className="px-6 py-3 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50"
            >
              返回编辑
            </button>
            <button
              onClick={() =>
                downloadImage(
                  refineResult.refinedImage,
                  `softdecor-refined-${Date.now()}.png`
                )
              }
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
            >
              下载精修图
            </button>
          </div>
        </div>
      )}

      {/* Feedback mode (from Gemini) */}
      {refineResult.mode === "feedback" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Original image */}
            <div>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">
                合成预览图
              </h3>
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-md">
                <img
                  src={refineResult.originalImage}
                  alt="Original"
                  className="w-full"
                />
              </div>
            </div>

            {/* AI feedback */}
            <div>
              <h3 className="text-sm font-semibold text-slate-600 mb-2">
                AI 分析与建议
              </h3>
              {refineResult.feedback && (
                <div className="space-y-3">
                  {refineResult.feedback.overall_score !== undefined && (
                    <div className="bg-slate-50 rounded-lg p-3">
                      <span className="text-sm text-slate-500">总体评分</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-3xl font-bold text-blue-600">
                          {refineResult.feedback.overall_score}
                        </div>
                        <span className="text-sm text-slate-400">/ 10</span>
                      </div>
                    </div>
                  )}

                  {refineResult.feedback.lighting_notes && (
                    <InfoBlock
                      label="光影分析"
                      text={refineResult.feedback.lighting_notes}
                    />
                  )}
                  {refineResult.feedback.composition_notes && (
                    <InfoBlock
                      label="构图分析"
                      text={refineResult.feedback.composition_notes}
                    />
                  )}
                  {refineResult.feedback.color_harmony && (
                    <InfoBlock
                      label="色彩协调性"
                      text={refineResult.feedback.color_harmony}
                    />
                  )}

                  {refineResult.feedback.suggestions?.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <span className="text-sm font-medium text-amber-800">
                        改进建议
                      </span>
                      <ul className="mt-2 space-y-1">
                        {refineResult.feedback.suggestions.map(
                          (s: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm text-amber-700 flex items-start gap-2"
                            >
                              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                              {s}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  {refineResult.feedback.refined_description && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <span className="text-sm font-medium text-blue-800">
                        理想效果描述
                      </span>
                      <p className="text-sm text-blue-700 mt-1">
                        {refineResult.feedback.refined_description}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={() => setStep("canvas")}
              className="px-6 py-3 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50"
            >
              返回编辑
            </button>
            <button
              onClick={() =>
                downloadImage(
                  refineResult.originalImage,
                  `softdecor-scene-${Date.now()}.png`
                )
              }
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
            >
              下载合成图
            </button>
          </div>
        </div>
      )}

      {/* Original mode (fallback) */}
      {refineResult.mode === "original" && (
        <div className="space-y-6">
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-lg max-w-2xl mx-auto">
            <img
              src={refineResult.originalImage}
              alt="Original"
              className="w-full"
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-amber-800">{refineResult.message}</p>
          </div>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setStep("canvas")}
              className="px-6 py-3 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50"
            >
              返回编辑
            </button>
            <button
              onClick={() =>
                downloadImage(
                  refineResult.originalImage,
                  `softdecor-scene-${Date.now()}.png`
                )
              }
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
            >
              下载合成图
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <span className="text-xs text-slate-500">{label}</span>
      <p className="text-sm text-slate-700 mt-1">{text}</p>
    </div>
  );
}
