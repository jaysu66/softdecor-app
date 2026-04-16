import React, { useEffect } from "react";
import { useStore } from "./stores/useStore";
import UploadPanel from "./components/UploadPanel";
import AnalysisResult from "./components/AnalysisResult";
import SchemeSelector from "./components/SchemeSelector";
import CanvasEditor from "./components/CanvasEditor";
import RefinePanel from "./components/RefinePanel";

const STEPS = [
  { key: "upload", label: "上传照片", num: 1 },
  { key: "analysis", label: "AI分析", num: 2 },
  { key: "recommend", label: "智能推荐", num: 3 },
  { key: "canvas", label: "场景编辑", num: 4 },
  { key: "result", label: "AI精修", num: 5 },
];

function getStepIndex(step: string): number {
  if (step === "analyzing") return 1;
  if (step === "recommending") return 2;
  if (step === "refining") return 4;
  const idx = STEPS.findIndex((s) => s.key === step);
  return idx >= 0 ? idx : 0;
}

export default function App() {
  const { step, setAllProducts } = useStore();

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => setAllProducts(data))
      .catch(console.error);
  }, []);

  const currentIdx = getStepIndex(step);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-lg font-bold">S</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                AI 软装搭配
              </h1>
              <p className="text-xs text-slate-500">
                智能场景生图系统
              </p>
            </div>
          </div>
          <ResetButton />
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    i <= currentIdx
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {s.num}
                </div>
                <span
                  className={`text-sm font-medium hidden sm:inline ${
                    i <= currentIdx ? "text-blue-700" : "text-slate-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    i < currentIdx ? "bg-blue-400" : "bg-slate-200"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 min-h-[500px]">
          {(step === "upload") && <UploadPanel />}
          {(step === "analyzing" || step === "analysis") && <AnalysisResult />}
          {(step === "recommending" || step === "recommend") && <SchemeSelector />}
          {step === "canvas" && <CanvasEditor />}
          {(step === "refining" || step === "result") && <RefinePanel />}
        </div>
      </div>
    </div>
  );
}

function ResetButton() {
  const reset = useStore((s) => s.reset);
  const step = useStore((s) => s.step);
  if (step === "upload") return null;

  return (
    <button
      onClick={reset}
      className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
    >
      重新开始
    </button>
  );
}
