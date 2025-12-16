/*
Node test runner (JS) that loads images from debug_test_images/ and compares TFLite outputs
with reference CSV values. It requires Node >=16 and that you run `npm run web` beforehand
so the model assets are copied to public/.

Usage:
  node scripts/run_tflite_tests.js --images debug_test_images --ref debug_reference.csv --out debug_results.csv

This script attempts to load the TFLite model using @tensorflow/tfjs and @tensorflow/tfjs-tflite in Node.
If that does not work in your environment, run the tests in the browser or use a Python script.
*/

const fs = require('fs');
const path = require('path');
const parse = require('csv-parse/lib/sync');
const stringify = require('csv-stringify/lib/sync');

async function main() {
  const argv = require('yargs')
    .option('images', { type: 'string', default: 'debug_test_images' })
    .option('ref', { type: 'string', default: 'debug_reference.csv' })
    .option('out', { type: 'string', default: 'debug_results.csv' })
    .argv;

  const imagesDir = path.resolve(process.cwd(), argv.images);
  const refPath = path.resolve(process.cwd(), argv.ref);
  const outPath = path.resolve(process.cwd(), argv.out);

  if (!fs.existsSync(imagesDir)) {
    console.error('images folder not found:', imagesDir);
    process.exit(1);
  }

  const imageFiles = fs.readdirSync(imagesDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));

  let references = {};
  if (fs.existsSync(refPath)) {
    const csv = fs.readFileSync(refPath, 'utf8');
    const rows = parse(csv, { columns: true, skip_empty_lines: true });
    for (const r of rows) {
      references[r.filename] = Number(r.p_reference);
    }
  } else {
    console.warn('Reference CSV not found, all p_reference values will be empty.');
  }

  // Try to import tfjs-tflite in Node
  let tf = null;
  let tflite = null;
  try {
    tf = require('@tensorflow/tfjs-node');
    tflite = require('@tensorflow/tfjs-tflite/dist/tf-tflite.node.js');
    console.log('Using tfjs-node + tfjs-tflite.node');
  } catch (e) {
    console.warn('Could not load tfjs-node / tfjs-tflite.node, test runner may not work in pure Node.');
    console.error(e.message);
    process.exit(1);
  }

  // set wasm path if needed (not necessary for node)

  // load model
  const modelPath = path.resolve(process.cwd(), 'public', 'morchella_classifier_small.tflite');
  if (!fs.existsSync(modelPath)) {
    console.error('Model file not found at public/', modelPath);
    process.exit(1);
  }

  const model = await (async () => {
    try {
      const mod = await tflite.loadTFLiteModel('file://' + modelPath);
      return mod;
    } catch (e) {
      console.error('Failed to load TFLite model in Node:', e);
      process.exit(1);
    }
  })();

  const rowsOut = [];
  const tolerance = 0.05;

  for (const file of imageFiles) {
    const imgPath = path.join(imagesDir, file);
    // For Node, simplest approach is to spawn a small headless browser or use sharp to read pixels.
    // Implement minimal decode using sharp to raw RGB
    const sharp = require('sharp');
    const img = sharp(imgPath).resize(224, 224).ensureAlpha().raw();
    const { data, info } = await img.toBuffer({ resolveWithObject: true });
    // data is Uint8
    const arr = new Uint8Array(data);
    // convert to float32 and normalize /255
    const floats = new Float32Array(info.width * info.height * 3);
    for (let i = 0, j = 0; i < arr.length; i += 4) {
      // RGBA -> take R G B
      floats[j++] = arr[i] / 255.0;
      floats[j++] = arr[i + 1] / 255.0;
      floats[j++] = arr[i + 2] / 255.0;
    }

    // For tfjs-tflite in Node, the API may accept raw typed array + shape
    let p_tflite = null;
    try {
      // create tensor [1,224,224,3]
      const input = tf.tensor(floats, [1, info.height, info.width, 3], 'float32');
      const out = await model.predict(input);
      let p = 0;
      if (out && out.data) {
        const d = await out.data();
        p = d.length === 1 ? d[0] : d[1] ?? d[0];
      } else if (Array.isArray(out)) {
        const d = await out[0].data();
        p = d.length === 1 ? d[0] : d[1] ?? d[0];
      }
      p_tflite = Number(p);
    } catch (e) {
      console.error('Error running model for', file, e);
    }

    const p_reference = references[file] ?? '';
    const pred_tflite = p_tflite === null ? '' : p_tflite >= 0.5 ? 'no_morchella' : 'morchella';
    const pred_reference = p_reference === '' ? '' : Number(p_reference) >= 0.5 ? 'no_morchella' : 'morchella';
    const diff_abs = p_tflite === null || p_reference === '' ? '' : Math.abs(Number(p_tflite) - Number(p_reference));
    const ok = diff_abs === '' ? '' : (diff_abs <= tolerance ? 'OK' : 'FAIL');

    rowsOut.push({ filename: file, p_tflite, pred_tflite, p_reference, pred_reference, diff_abs, ok });
  }

  const csv = stringify(rowsOut, { header: true });
  fs.writeFileSync(outPath, csv);
  console.log('Wrote results to', outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
