#!/usr/bin/env bash
# fetch-model.sh
# Downloads the NER model + the matching ONNX Runtime WASM files so the
# extension runs 100% offline.
#
# The .jsep.wasm binary lives in the onnxruntime-web package (a dependency of
# @huggingface/transformers) inside node_modules. We search node_modules for
# the real files rather than guessing CDN URLs.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS="$ROOT/models"
MODEL_DIR="$MODELS/distilbert-NER-ONNX"
HF_BASE="https://huggingface.co/onnx-community/distilbert-NER-ONNX/resolve/main"

rm -rf "$MODELS"
mkdir -p "$MODEL_DIR/onnx"

echo "→ Fetching tokenizer + config…"
for f in config.json tokenizer.json tokenizer_config.json; do
  curl -L --fail -o "$MODEL_DIR/$f" "$HF_BASE/$f"
done

echo "→ Fetching int8 quantized model (~62MB)…"
curl -L --fail -o "$MODEL_DIR/onnx/model_quantized.onnx" "$HF_BASE/onnx/model_quantized.onnx"
cp "$MODEL_DIR/onnx/model_quantized.onnx" "$MODEL_DIR/onnx/model_int8.onnx"
SIZE_MB=$(( $(wc -c < "$MODEL_DIR/onnx/model_int8.onnx") / 1024 / 1024 ))
echo "  ✓ model is ${SIZE_MB}MB"

echo "→ Searching node_modules for the ONNX Runtime jsep files (the only ones used)…"
# We only need the jsep variant (.mjs loader + .wasm binary). Copy just those —
# no need to ship the asyncify/jspi/non-simd variants (saves ~115MB).
FOUND=0
for name in ort-wasm-simd-threaded.jsep.mjs ort-wasm-simd-threaded.jsep.wasm; do
  src="$(find "$ROOT/node_modules" -type f -name "$name" 2>/dev/null | head -1)"
  if [ -n "$src" ]; then
    cp "$src" "$MODELS/"
    echo "  ✓ $name"
    FOUND=$((FOUND+1))
  fi
done

if [ "$FOUND" -lt 2 ]; then
  echo "  ⚠ couldn't find both jsep files in node_modules; fetching from CDN…"
  ORT_VER="$(node -p "require('./node_modules/onnxruntime-web/package.json').version" 2>/dev/null || echo "")"
  if [ -n "$ORT_VER" ]; then
    for name in ort-wasm-simd-threaded.jsep.mjs ort-wasm-simd-threaded.jsep.wasm; do
      [ -f "$MODELS/$name" ] || curl -L --fail -o "$MODELS/$name" \
        "https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VER}/dist/$name" \
        && echo "  ✓ $name (CDN)"
    done
  fi
fi

# Keep only one copy of the model under the name the loader uses (model_int8.onnx).
rm -f "$MODEL_DIR/onnx/model_quantized.onnx" 2>/dev/null || true

if [ -f "$MODELS/ort-wasm-simd-threaded.jsep.wasm" ]; then
  echo "  ✓ REQUIRED binary present: ort-wasm-simd-threaded.jsep.wasm"
else
  echo "  ✗ MISSING ort-wasm-simd-threaded.jsep.wasm — NER will fall back to regex."
fi

echo ""
echo "✓ Files in models/:"
ls -1 "$MODELS"
echo "Total size:"
du -sh "$MODELS"
