import React, { useState } from "react";
import { useStore, Scheme } from "../stores/useStore";
import ProductGrid from "./ProductGrid";

export default function SchemeSelector() {
  const { step, schemes, selectedProducts, setSelectedProducts, setStep, allProducts } =
    useStore();
  const [activeScheme, setActiveScheme] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (step === "recommending") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h3 className="text-xl font-semibold text-slate-700 mb-2">
          AI 正在为您推荐商品...
        </h3>
        <p className="text-slate-500">
          根据房间风格和空间特点匹配最佳商品
        </p>
      </div>
    );
  }

  const selectScheme = (scheme: Scheme) => {
    setActiveScheme(scheme.id);
    setSelectedProducts(scheme.products);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">
        AI 推荐方案
      </h2>
      <p className="text-slate-500 text-center mb-6">
        选择一个方案，或自由挑选商品
      </p>

      {/* Scheme cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {schemes.map((scheme) => (
          <div
            key={scheme.id}
            className={`border-2 rounded-xl p-5 cursor-pointer transition-all ${
              activeScheme === scheme.id
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-blue-300"
            }`}
            onClick={() => selectScheme(scheme)}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-800">{scheme.name}</h3>
                <p className="text-sm text-slate-500">{scheme.description}</p>
              </div>
              <span className="text-lg font-bold text-red-500">
                ¥{scheme.totalPrice.toLocaleString()}
              </span>
            </div>

            {/* Mini product previews */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {scheme.products.slice(0, 6).map((p) => (
                <img
                  key={p.sku}
                  src={p.img}
                  alt={p.name}
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                  crossOrigin="anonymous"
                />
              ))}
              {scheme.products.length > 6 && (
                <div className="w-14 h-14 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 text-xs text-slate-500">
                  +{scheme.products.length - 6}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected products */}
      {selectedProducts.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-slate-700 mb-3">
            已选商品 ({selectedProducts.length} 件)
            <span className="ml-2 text-sm font-normal text-slate-500">
              总计 ¥
              {selectedProducts
                .reduce((s, p) => s + p.price, 0)
                .toLocaleString()}
            </span>
          </h3>
          <ProductGrid products={selectedProducts} />
        </div>
      )}

      {/* Browse all products */}
      <div className="border-t border-slate-200 pt-6">
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-blue-600 hover:text-blue-800 mb-4"
        >
          {showAll ? "收起全部商品" : "浏览全部商品自由选配"}
        </button>

        {showAll && (
          <ProductGrid products={allProducts} />
        )}
      </div>

      {/* Proceed button */}
      {selectedProducts.length > 0 && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setStep("canvas")}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            进入场景编辑 ({selectedProducts.length} 件商品)
          </button>
        </div>
      )}
    </div>
  );
}
