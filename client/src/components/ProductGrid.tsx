import React from "react";
import { Product, useStore } from "../stores/useStore";

interface Props {
  products: Product[];
  selectable?: boolean;
}

export default function ProductGrid({ products, selectable = true }: Props) {
  const { selectedProducts, addProduct, removeProduct } = useStore();

  const isSelected = (sku: string) =>
    selectedProducts.some((p) => p.sku === sku);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => {
        const selected = isSelected(product.sku);
        return (
          <div
            key={product.sku}
            className={`rounded-xl border-2 overflow-hidden transition-all cursor-pointer hover:shadow-md ${
              selected
                ? "border-blue-500 shadow-blue-100 shadow-md"
                : "border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => {
              if (!selectable) return;
              if (selected) {
                removeProduct(product.sku);
              } else {
                addProduct(product);
              }
            }}
          >
            <div className="relative aspect-square bg-slate-100">
              <img
                src={product.img}
                alt={product.name}
                className="w-full h-full object-cover"
                loading="lazy"
                crossOrigin="anonymous"
              />
              {selected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <span className="text-xs text-white/80">
                  {product.style} / {product.cat}
                </span>
              </div>
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-slate-800 truncate">
                {product.name}
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-bold text-red-500">
                  ¥{product.price.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">{product.sku}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
