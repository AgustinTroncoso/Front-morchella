/*
Comprehensive TFLite inference helper for Expo (web) and instructions for native.
- Loads TFLite model from assets
- Loads labels.txt from assets and builds index->label map
- Preprocesses image: RGB, resize 224x224, float32, /255.0, add batch
- Runs inference via @tensorflow/tfjs-tflite (web build)
- Postprocesses sigmoid scalar p -> {p, 1-p} and prediction
- Handles optional quantization parameters if provided (see below)

Usage:
import { inferFromImage, loadLabelsFromAsset } from '@/services/tfliteInference';
const res = await inferFromImage(imageUri);

Notes: this implementation targets Web (Expo web) using tfjs-tflite. For native (Android/iOS)
use a native bridge (react-native-tflite or TensorFlow Lite via native module). See README below.
*/

import * as tf from '@tensorflow/tfjs';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

let tflite: any = null;
let modelInstance: any = null;
let labelsMap: string[] | null = null;

// Config
const TARGET_SIZE = 224;
const MODEL_ASSET = require('../assets/models/morchella_classifier_small.tflite');
const LABELS_ASSET = require('../assets/models/labels.txt');

// Optional metadata JSON next to the model (containing quantization info if needed)
// Example: assets/models/morchella_classifier_small.metadata.json
const MODEL_METADATA_ASSET_PATH = '../assets/models/morchella_classifier_small.metadata.json';

export type InferenceResult = {
  p: number; // probability of label index 1 (per your training: p represents index 1)
  probs: { [label: string]: number };
  prediction: string;
  confidence: number; // abs(prob difference from 0.5) scaled to 0..1
  rawOutput: number | number[];
};

async function ensureTFLite() {
  if (tflite) return tflite;
  // dynamic import of the web build
  tflite = await import('@tensorflow/tfjs-tflite/dist/tf-tflite.min.js');
  // set wasm path where we copied the runtime files (public/tflite)
  try {
    if (typeof tflite.setWasmPath === 'function') tflite.setWasmPath('/tflite/');
  } catch (e) {
    console.warn('setWasmPath not available', e);
  }
  return tflite;
}

export async function loadLabels(): Promise<string[]> {
  if (labelsMap) return labelsMap;
  try {
    const asset = Asset.fromModule(LABELS_ASSET);
    await asset.downloadAsync();
    const res = await fetch(asset.localUri ?? asset.uri);
    const txt = await res.text();
    // Expect lines like: "0 morchella" or just "morchella" per-line — handle both
    const lines = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const map: string[] = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length === 1) {
        map.push(parts[0]);
      } else if (/^\d+$/.test(parts[0])) {
        const idx = Number(parts[0]);
        const label = parts.slice(1).join(' ');
        map[idx] = label;
      } else {
        // fallback: take last token as label
        map.push(parts.join(' '));
      }
    }
    labelsMap = map;
    console.log('Loaded labels:', labelsMap);
    return map;
  } catch (e) {
    console.warn('Failed to load labels.txt from assets', e);
    throw e;
  }
}

async function loadModel() {
  if (modelInstance) return modelInstance;
  if (Platform.OS !== 'web') {
    // Native runtimes not provided here — recommend using native bridge
    console.warn('TFLite inference helper currently implemented for web with tfjs-tflite. For native, use a native bridge.');
  }
  await ensureTFLite();

  const modelAsset = Asset.fromModule(MODEL_ASSET);
  await modelAsset.downloadAsync();
  const modelUrl = modelAsset.localUri ?? modelAsset.uri;
  modelInstance = await tflite.loadTFLiteModel(modelUrl);
  console.log('Loaded TFLite model from', modelUrl);
  return modelInstance;
}

function imageToHTMLImageElement(imageUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (ev) => reject(new Error('Failed to load image ' + imageUri));
    img.src = imageUri;
  });
}

async function preprocessImageToTensor(imageUri: string): Promise<tf.Tensor4D> {
  // This implementation is for web (HTMLImageElement). For native, you must read the file and decode pixels.
  const img = await imageToHTMLImageElement(imageUri);
  // Convert to tensor
  const tfAny = tf as any;
  const tensor = tfAny.browser?.fromPixels?.(img) || tf.fromPixels(img as any);
  // Ensure RGB ordering (fromPixels yields RGBA or RGB depending)
  let rgb = tensor;
  if (tensor.shape[2] === 4) {
    // drop alpha
    rgb = tensor.slice([0, 0, 0], [-1, -1, 3]);
  }
  // Resize to TARGET_SIZE
  const resized = tf.image.resizeBilinear(rgb as tf.Tensor3D, [TARGET_SIZE, TARGET_SIZE]);
  // Convert to float32 and normalize by 255.0
  const float = (resized as tf.Tensor3D).toFloat().div(255.0);
  // Expand dims to make batch
  const batched = float.expandDims(0) as tf.Tensor4D; // [1, H, W, C]

  // Debug stats
  const vals = await batched.data();
  const min = Math.min(...Array.from(vals));
  const max = Math.max(...Array.from(vals));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  console.log('Preprocessed image stats min/max/mean:', min, max, mean);

  // cleanup intermediate tensors
  tensor.dispose();
  if (rgb !== tensor) rgb.dispose();
  resized.dispose();
  // leave float/batched for inference
  return batched;
}

function dequantizeValue(q: number, scale: number, zero_point: number) {
  return scale * (q - zero_point);
}

async function tryLoadMetadata(): Promise<any | null> {
  try {
    // try to load a metadata json next to the model if present
    // note: Metro may bundle json assets differently; we attempt a relative require
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // const meta = require(MODEL_METADATA_ASSET_PATH);
    // Instead, try to fetch via Asset (if exists)
    // For simplicity, attempt fetch from public path: '/morchella_classifier_small.metadata.json'
    const p = '/morchella_classifier_small.metadata.json';
    const r = await fetch(p);
    if (!r.ok) return null;
    const json = await r.json();
    console.log('Loaded model metadata', json);
    return json;
  } catch (e) {
    return null;
  }
}

export async function inferFromImage(imageUri: string): Promise<InferenceResult> {
  const labels = await loadLabels();
  const model = await loadModel();

  const inputTensor = await preprocessImageToTensor(imageUri);

  // Run prediction
  const rawOutput = await model.predict(inputTensor as any);

  // rawOutput can be a tensor or array
  let p_raw: number;
  if (rawOutput == null) throw new Error('Model returned null output');
  if ((rawOutput as any).data) {
    // tensor
    const outTensor = rawOutput as tf.Tensor;
    const data = await outTensor.data();
    // if scalar, pick first
    if (data.length === 0) throw new Error('Empty output from model');
    if (data.length === 1) p_raw = data[0];
    else {
      // multiple outputs: try to find index 1 as per your note (p is for index 1)
      // But training note said model outputs sigmoid scalar p for index 1 -> prefer scalar
      // If vector, assume p corresponds to index 1
      p_raw = data.length > 1 ? data[1] : data[0];
    }
    outTensor.dispose();
  } else if (Array.isArray(rawOutput)) {
    const arr = rawOutput as any[];
    const first = arr[0];
    if (first && first.data) {
      const data = await first.data();
      p_raw = data.length === 1 ? data[0] : data[1] ?? data[0];
    } else if (typeof first === 'number') {
      p_raw = first;
    } else {
      throw new Error('Unsupported model output format');
    }
  } else if (typeof rawOutput === 'number') {
    p_raw = rawOutput;
  } else {
    // fallback: try JSON
    try {
      p_raw = Number(rawOutput as any);
    } catch (e) {
      throw new Error('Cannot parse model output');
    }
  }

  // If model output is quantized, you may need to dequantize here. Try metadata lookup
  const meta = await tryLoadMetadata();
  if (meta && meta.output_quantization) {
    const { scale, zero_point } = meta.output_quantization;
    const p_deq = dequantizeValue(p_raw, scale, zero_point);
    console.log('Dequantized output', { p_raw, p_deq });
    p_raw = p_deq;
  }

  // The training note: model produces sigmoid scalar p which is prob for class index 1.
  const p = Number(p_raw);
  const prob_label1 = p;
  const prob_label0 = 1 - p;

  const probs: { [label: string]: number } = {};
  // labels array: ensure indices exist
  const label0 = labels[0] ?? 'label_0';
  const label1 = labels[1] ?? 'label_1';
  probs[label0] = prob_label0;
  probs[label1] = prob_label1;

  const prediction = prob_label1 >= prob_label0 ? label1 : label0;
  const confidence = Math.abs(prob_label1 - 0.5) * 2; // 0..1

  // Debug logs
  console.log('raw p', p);
  console.log('labels map', labels);

  // cleanup
  inputTensor.dispose();

  return {
    p,
    probs,
    prediction,
    confidence,
    rawOutput: p_raw,
  };
}

// Export helper to run multiple images (for UI or tests)
export async function inferMultiple(imageUris: string[]) {
  const out: { uri: string; res: InferenceResult | null; err?: any }[] = [];
  for (const uri of imageUris) {
    try {
      const r = await inferFromImage(uri);
      out.push({ uri, res: r });
    } catch (e) {
      out.push({ uri, res: null, err: e });
    }
  }
  return out;
}
