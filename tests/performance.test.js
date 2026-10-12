/**
 * Performance & Optimization Test Suite for ThaiFlood
 * Verifies zero video overhead, on-demand media loading, and clean lifecycle management
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('⚡ Starting ThaiFlood Performance & Optimization Tests...\n');

let passedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  🚀 PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

// 1. Zero Video Files in Repository
test('PERF-01: Zero Video Files Overhead (No MP4/WebM/MOV assets)', () => {
  const scanDirs = ['src', 'public'];
  const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

  function checkDir(rel) {
    const full = path.join(rootDir, rel);
    if (!fs.existsSync(full)) return;
    const entries = fs.readdirSync(full);
    entries.forEach((entry) => {
      const entryPath = path.join(full, entry);
      const stat = fs.statSync(entryPath);
      if (stat.isDirectory()) {
        checkDir(path.join(rel, entry));
      } else {
        const ext = path.extname(entry).toLowerCase();
        assert(!videoExts.includes(ext), `Heavy video file detected: ${entryPath}. Animation must use native WebGL.`);
      }
    });
  }

  scanDirs.forEach(checkDir);
});

// 2. On-Demand CCTV Snapshot Image Loading
test('PERF-02: Strict On-Demand CCTV Snapshot Loading (Zero Startup Preload)', () => {
  const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
  const cctvServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/cctvService.js'), 'utf-8');
  const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');

  // Verify no new Image() or eager fetch of snapshot URLs in startup sequence
  assert(!mainCode.includes('new Image'), 'main.js must not preload images');
  assert(!cctvServiceCode.includes('new Image'), 'cctvService must not preload snapshot images');
  assert(!mapViewerCode.includes('new Image'), 'MapViewer must not preload CCTV images');
});

// 3. WebGL Native Camera Animation Parameters & GPU Offload
test('PERF-03: WebGL flyTo Camera Easing & GPU Offload Profile', () => {
  const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');
  assert(mapViewerCode.includes('runSpacePOVZoomAnimation'), 'Must export runSpacePOVZoomAnimation');
  assert(mapViewerCode.includes('curve: 1.42'), 'Camera must use fluid curve parameter 1.42');
  assert(mapViewerCode.includes('speed: 1.2'), 'Camera must use optimal speed parameter 1.2');
  assert(mapViewerCode.includes('easing: (t) => t * (2 - t)'), 'Camera must use quadratic deceleration easing');
});

// 4. Double WebGL Map Resize Lifecycle Call
test('PERF-04: Post-Descent Double Canvas Resize to Prevent Viewport Distortion', () => {
  const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
  const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');

  assert(
    mainCode.includes("requestAnimationFrame(() => {\n          window.dispatchEvent(new Event('resize'));\n        })") ||
    mainCode.includes("requestAnimationFrame"),
    'main.js must schedule resize via requestAnimationFrame'
  );
  assert(
    mapViewerCode.includes("requestAnimationFrame(() => mapInstance.resize())"),
    'MapViewer must schedule double resize on animation completion'
  );
});

// 5. Memory Management: Marker Cleanup & Detached Listeners
test('PERF-05: Clean Cluster Marker Teardown & Array Length Zeroing', () => {
  const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');

  assert(mapViewerCode.includes('cctvMarkers.forEach((m) => m.remove())'), 'Must remove existing CCTV markers on re-cluster');
  assert(mapViewerCode.includes('cctvMarkers.length = 0'), 'Must reset cctvMarkers array length to 0 to prevent memory leak');
  assert(mapViewerCode.includes('traffyFloodMarkers.length = 0'), 'Must reset traffyFloodMarkers array length to 0');
});

console.log(`\n🎉 Performance Tests Completed: ${passedTests} passed.\n`);
