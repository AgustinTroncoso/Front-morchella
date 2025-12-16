// services/morchellaModel.ts
import * as tf from '@tensorflow/tfjs';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
// Cargaremos dinámicamente el build web de tfjs-tflite para evitar que
// Metro/Expo intente resolver el entry Node.js que provoca errores
// (falta de archivos y `self is not defined`).
let tflite: any = null;
// Import estático del asset para que Metro lo incluya correctamente.
// El tipo está declarado en `types/assets.d.ts`.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import modelAsset from '../assets/models/morchella_classifier_small.tflite';

let morchellaModel: any | null = null;

// Tamaño esperado por el modelo (ajusta según tu modelo)
const TARGET_SIZE = 224;

export async function loadMorchellaModel() {
  if (morchellaModel) return morchellaModel;

    // Soporte tanto para web (tfjs-tflite) como para plataformas nativas (Android/iOS)
    if (Platform.OS === 'web') {
      try {
        // Cargar el bundle web como antes
        if (!tflite) {
          // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
          tflite = await import('@tensorflow/tfjs-tflite/dist/tf-tflite.min.js');

          try {
            if (typeof tflite.setWasmPath === 'function') {
              tflite.setWasmPath('/tflite/');
            }
          } catch (e) {
            console.warn('No se pudo establecer wasm path en tfjs-tflite:', e);
          }
        }

        const asset = Asset.fromModule(modelAsset as any);
        await asset.downloadAsync();
        const modelUrl = asset.localUri ?? asset.uri;

        morchellaModel = await tflite.loadTFLiteModel(modelUrl);
        console.log('✅ Modelo de morchella cargado correctamente (web)');
        return morchellaModel;
      } catch (error) {
        console.error('Error al cargar el modelo (web):', error);
        throw new Error('No se pudo cargar el modelo en web.');
      }
    }

    // Plataformas nativas: intentar usar un binding nativo a TFLite.
    try {
      // Intentar cargar una de las bibliotecas más comunes dinámicamente.
      // Nota: debes instalar y linkear `tflite-react-native` o `react-native-tflite` en el proyecto nativo.
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const TfliteLib = require('tflite-react-native') || require('react-native-tflite');
      // Algunas versiones exportan la clase directamente, otras exportan un objeto.
      // Normalizamos la creación de la instancia.
      // eslint-disable-next-line new-cap
      const tfliteNative = new (TfliteLib.default || TfliteLib)();

      // En Android el modelo debe copiarse a `android/app/src/main/assets/morchella_classifier_small.tflite`
      await new Promise((resolve, reject) => {
        tfliteNative.loadModel(
          { model: 'morchella_classifier_small.tflite' },
          (err: any, res: any) => {
            if (err) reject(err);
            else resolve(res);
          }
        );
      });

      morchellaModel = tfliteNative;
      console.log('✅ Modelo de morchella cargado correctamente (nativo)');
      return morchellaModel;
    } catch (nativeError) {
      console.error('Error al cargar el modelo nativo TFLite:', nativeError);
      throw new Error('No se pudo cargar el modelo nativo. Asegúrate de ejectuar Expo a bare workflow, instalar `tflite-react-native` (o `react-native-tflite`) y copiar el .tflite en Android assets.');
    }
}

export type MorchellaResult = {
  isMorchella: boolean;
  probability: number; // 0..1
  confidence: number;  // 0..1
};

/**
 * Carga una imagen desde una URI y la convierte en un tensor normalizado
 */
async function loadAndPreprocessImage(imageUri: string): Promise<tf.Tensor4D> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Convertir la imagen a tensor (solo funciona en web)
        // Usamos any para evitar problemas de tipos con tf.browser
        const tfAny = tf as any;
        const tensor = tfAny.browser?.fromPixels?.(img) || tfAny.fromPixels?.(img);
        
        if (!tensor) {
          throw new Error('No se pudo convertir la imagen a tensor');
        }
        
        // Redimensionar a TARGET_SIZE x TARGET_SIZE
        const resized = tfAny.image?.resizeBilinear?.(tensor, [TARGET_SIZE, TARGET_SIZE]) || 
                       tensor.resizeBilinear?.([TARGET_SIZE, TARGET_SIZE]);
        
        if (!resized) {
          throw new Error('No se pudo redimensionar la imagen');
        }
        
        // Normalizar valores de 0-255 a 0-1
        const normalized = resized.div(255.0);
        
        // Expandir dimensiones para batch: [1, height, width, channels]
        const batched = normalized.expandDims(0);
        
        // Limpiar tensores intermedios
        tensor.dispose();
        resized.dispose();
        normalized.dispose();
        
        resolve(batched as tf.Tensor4D);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('No se pudo cargar la imagen'));
    };
    
    img.src = imageUri;
  });
}

/**
 * Analiza una imagen usando el modelo TFLite de morchella
 */
export async function analyzeImageWithTFLite(imageUri: string): Promise<MorchellaResult> {
  // Soporte web y nativo
  if (Platform.OS === 'web') {
    try {
      const model = await loadMorchellaModel();

      // Preprocesar la imagen (solo web)
      const preprocessedImage = await loadAndPreprocessImage(imageUri);

      const predictionOutput = model.predict(preprocessedImage as any);

      let prediction: tf.Tensor;
      if (Array.isArray(predictionOutput)) {
        prediction = predictionOutput[0] as unknown as tf.Tensor;
      } else if (predictionOutput && typeof predictionOutput === 'object') {
        if ('tensor' in predictionOutput) {
          prediction = (predictionOutput as any).tensor as unknown as tf.Tensor;
        } else {
          prediction = predictionOutput as unknown as tf.Tensor;
        }
      } else {
        prediction = predictionOutput as unknown as tf.Tensor;
      }

      const predictionData = await prediction.data();

      preprocessedImage.dispose();
      prediction.dispose();

      let p_index1: number;
      if (predictionData.length >= 2) {
        p_index1 = predictionData[1];
      } else if (predictionData.length === 1) {
        p_index1 = predictionData[0];
      } else {
        p_index1 = Array.isArray(predictionData) ? predictionData[0] : Number(predictionData);
      }

      p_index1 = Math.max(0, Math.min(1, Number(p_index1)));
      let morchellaProbability = 1 - p_index1;
      const isMorchella = morchellaProbability > 0.5;
      morchellaProbability = Math.max(0, Math.min(1, morchellaProbability));
      const confidence = Math.abs(morchellaProbability - 0.5) * 2;

      return { isMorchella, probability: morchellaProbability, confidence };
    } catch (error) {
      console.error('Error al analizar imagen con modelo TFLite (web):', error);
      throw error;
    }
  }

  // Nativo (Android / iOS) usando binding react-native tflite
  try {
    const modelNative = await loadMorchellaModel();

    const runModel = (modelNative.runModelOnImage || modelNative.runModelOnImageBinary) as any;
    if (!runModel) {
      throw new Error('La librería nativa TFLite no exporta `runModelOnImage`.');
    }

    // Para Android/iOS esperamos una ruta de archivo local. Si la URI viene con
    // el prefijo `file://` lo eliminamos.
    let imagePath = imageUri;
    if (imagePath.startsWith('file://')) imagePath = imagePath.replace('file://', '');

    const nativeResult = await new Promise<any>((resolve, reject) => {
      runModel.call(
        modelNative,
        {
          path: imagePath,
          imageMean: 0,
          imageStd: 255.0,
          inputSize: TARGET_SIZE,
          numResults: 2,
          threshold: 0.01,
        },
        (err: any, res: any) => {
          if (err) reject(err);
          else resolve(res);
        }
      );
    });

    let morchellaProbability = 0;
    if (Array.isArray(nativeResult) && nativeResult.length > 0) {
      const byLabel = nativeResult.find((r: any) => (r.label || '').toString().toLowerCase().includes('morchella'));
      if (byLabel) morchellaProbability = Number(byLabel.confidence ?? byLabel.probability ?? 0);
      else if (nativeResult[0].confidence != null && nativeResult[1] != null) {
        morchellaProbability = Number(nativeResult[0].confidence ?? 0);
      } else {
        morchellaProbability = Number(nativeResult[0].confidence ?? 0);
      }
    } else if (nativeResult && typeof nativeResult === 'object') {
      morchellaProbability = Number(nativeResult.confidence ?? nativeResult.probability ?? 0);
    }

    morchellaProbability = Math.max(0, Math.min(1, morchellaProbability));
    const isMorchella = morchellaProbability > 0.5;
    const confidence = Math.abs(morchellaProbability - 0.5) * 2;

    return { isMorchella, probability: morchellaProbability, confidence };
  } catch (error) {
    console.error('Error al analizar imagen con modelo TFLite (nativo):', error);
    throw error;
  }

}
