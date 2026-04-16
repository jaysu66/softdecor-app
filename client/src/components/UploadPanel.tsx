import React, { useCallback, useState, useRef, useEffect } from "react";
import { useStore } from "../stores/useStore";

// 前端图片压缩 - 参考窗帘智能体的 Canvas 方案
async function compressImage(file: File, maxDim = 1800, quality = 0.88): Promise<File> {
  // 小于500KB不压缩
  if (file.size < 500 * 1024) return file;

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
          });
          console.log(`Compressed: ${(file.size/1024).toFixed(0)}KB → ${(compressed.size/1024).toFixed(0)}KB (${w}x${h})`);
          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export default function UploadPanel() {
  const { setUploadedImage, setStep, setAnalysis } = useStore();
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [backgrounds, setBackgrounds] = useState<{name: string; url: string}[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load test backgrounds
  useEffect(() => {
    fetch("/api/backgrounds")
      .then(r => r.json())
      .then(data => setBackgrounds(data))
      .catch(() => {});
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("请上传图片文件（JPG/PNG）");
      return;
    }

    // 压缩图片
    let processedFile = file;
    try {
      processedFile = await compressImage(file);
    } catch (e) {
      console.warn("Compression failed, using original:", e);
    }

    // Compress to JPEG for preview and analysis (keep small)
    setUploading(true);
    const img = new Image();
    const objectUrl = URL.createObjectURL(processedFile);
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 800;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.75);
      console.log(`Compressed: ${img.width}x${img.height} -> ${w}x${h}, ${(compressedBase64.length/1024).toFixed(0)}KB`);

      setPreview(compressedBase64);
      setUploadedImage(objectUrl, compressedBase64);
      setUploading(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      alert("图片加载失败");
      setUploading(false);
    };
    img.src = objectUrl;
  }, []);

  const handleAnalyze = async () => {
    const base64 = useStore.getState().uploadedImageBase64;
    if (!base64) return;

    setStep("analyzing");

    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      const data = await resp.json();

      if (data.success) {
        setAnalysis(data.analysis);
        setStep("analysis");
      } else {
        alert("Analysis failed: " + (data.error || "Unknown error"));
        setStep("upload");
      }
    } catch (err: any) {
      alert("Analysis error: " + err.message);
      setStep("upload");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">
        上传房间照片
      </h2>
      <p className="text-slate-500 text-center mb-8">
        上传一张您想要进行软装搭配的房间照片，AI将为您分析并推荐方案
      </p>

      {!preview ? (
        <>
        <div
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-lg font-medium text-slate-700 mb-2">
            拖拽图片到这里，或点击选择
          </p>
          <p className="text-sm text-slate-400">支持 JPG、PNG 格式</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Test background images */}
        {backgrounds.length > 0 && (
          <div className="mt-8">
            <p className="text-sm font-medium text-slate-600 mb-3 text-center">或选择测试背景图</p>
            <div className="grid grid-cols-5 gap-3">
              {backgrounds.map((bg) => (
                <div
                  key={bg.url}
                  className="cursor-pointer rounded-xl overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition-colors group"
                  onClick={async () => {
                    setUploading(true);
                    try {
                      // Load image and compress via Canvas
                      const img = new Image();
                      img.crossOrigin = "anonymous";
                      img.onload = () => {
                        const maxDim = 800;
                        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                        const w = Math.round(img.width * scale);
                        const h = Math.round(img.height * scale);
                        const canvas = document.createElement("canvas");
                        canvas.width = w;
                        canvas.height = h;
                        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
                        const base64 = canvas.toDataURL("image/jpeg", 0.75);
                        console.log(`BG compressed: ${img.width}x${img.height} -> ${w}x${h}, ${(base64.length/1024).toFixed(0)}KB`);
                        setPreview(base64);
                        setUploadedImage(bg.url, base64);
                        setUploading(false);
                      };
                      img.onerror = () => { setUploading(false); alert("加载背景图失败"); };
                      img.src = bg.url;
                    } catch {
                      setUploading(false);
                      alert("加载背景图失败");
                    }
                  }}
                >
                  <img
                    src={bg.url}
                    alt={bg.name}
                    className="w-full h-20 object-cover group-hover:scale-105 transition-transform"
                  />
                  <p className="text-xs text-slate-500 text-center py-1 truncate px-1">{bg.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
      ) : (
        <div className="space-y-6">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md">
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-[500px] object-contain bg-slate-100"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="bg-white rounded-lg px-6 py-3 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-700">上传中...</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                setPreview(null);
                setUploadedImage(null, null);
              }}
              className="px-6 py-3 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
            >
              重新选择
            </button>
            <button
              onClick={handleAnalyze}
              disabled={uploading || !useStore.getState().uploadedImageBase64}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              AI 分析房间
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
