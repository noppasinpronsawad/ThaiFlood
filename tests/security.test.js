/**
 * Security Test Suite for ThaiFlood
 * Verifies local network binding, API transport encryption, and prevention of injection vulnerabilities
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🔒 Starting ThaiFlood Security Tests...\n');

let passedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  🛡️ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
    process.exitCode = 1;
  }
}

// 1. UAT Port Isolation & Host Binding Check
test('Vite Configuration: Restricted to 127.0.0.1 & strict Port 3050', () => {
  const config = fs.readFileSync(path.join(rootDir, 'vite.config.js'), 'utf-8');
  assert(config.includes('port: 3050'), 'Vite must be strictly configured on Port 3050');
  assert(config.includes("host: '127.0.0.1'"), 'Server must bind only to 127.0.0.1 (no public 0.0.0.0 binding)');
  assert(config.includes('strictPort: true'), 'strictPort must be true to prevent port jumping');
});

// 2. Process Cleanup Script Integrity
test('Cleanup Process Script: Validates port 3050 zombie process termination', () => {
  const scriptPath = path.join(rootDir, 'scripts/cleanup-process.sh');
  assert(fs.existsSync(scriptPath), 'cleanup-process.sh script must exist');
  const content = fs.readFileSync(scriptPath, 'utf-8');
  assert(content.includes('3050'), 'Script must target port 3050');
  assert(content.includes('lsof') || content.includes('kill'), 'Script must perform process termination');
});

// 3. Transport Layer Security (HTTPS Only for external resources)
test('External Network Calls: Enforce HTTPS for all external API endpoints', () => {
  const weatherServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/weatherService.js'), 'utf-8');
  const mapViewerCode = fs.readFileSync(path.join(rootDir, 'src/components/MapViewer.js'), 'utf-8');

  // Verify weather APIs use https
  assert(weatherServiceCode.includes('https://api.open-meteo.com'), 'Open-Meteo must use HTTPS');
  assert(!weatherServiceCode.includes('http://api.open-meteo.com'), 'Insecure HTTP forbidden for Open-Meteo');

  const nwpServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/nwpForecastService.js'), 'utf-8');
  assert(nwpServiceCode.includes('https://api.open-meteo.com'), 'NWP Service Open-Meteo must use HTTPS');
  assert(!nwpServiceCode.includes('http://api.open-meteo.com'), 'Insecure HTTP forbidden for NWP Service');

  const tmdServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/tmdWeatherService.js'), 'utf-8');
  assert(tmdServiceCode.includes('https://data.tmd.go.th'), 'TMD API must use HTTPS');
  assert(!tmdServiceCode.includes('http://data.tmd.go.th'), 'Insecure HTTP forbidden for TMD');

  // Verify Basemap tiles (OpenStreetMap & ESRI Satellite & OpenTopoMap Contours & 30m Terrarium DEM) use https and no insecure http
  assert(mapViewerCode.includes('https://a.tile.openstreetmap.org'), 'OSM basemap tiles must use HTTPS');
  assert(mapViewerCode.includes('https://server.arcgisonline.com'), 'ESRI tiles must use HTTPS');
  assert(mapViewerCode.includes('opentopomap.org'), 'OpenTopoMap Contour Lines layer must be configured');
  assert(mapViewerCode.includes('elevation-tiles-prod/terrarium'), 'High-resolution Terrarium DEM layer must be configured');
  assert(!mapViewerCode.includes('http://a.tile.openstreetmap.org'), 'Insecure HTTP forbidden for OSM');
  assert(!mapViewerCode.includes('http://server.arcgisonline.com'), 'Insecure HTTP forbidden for ESRI');
  assert(!mapViewerCode.includes('http://a.tile.opentopomap.org'), 'Insecure HTTP forbidden for OpenTopoMap');
  assert(!mapViewerCode.includes('http://s3.amazonaws.com/elevation-tiles-prod'), 'Insecure HTTP forbidden for Terrarium DEM');

  // Verify DMR Geology MapServer APIs use HTTPS
  assert(mapViewerCode.includes('https://gisportal.dmr.go.th'), 'DMR Geology API must use HTTPS');
  assert(!mapViewerCode.includes('http://gisportal.dmr.go.th'), 'Insecure HTTP forbidden for DMR Geology API');

  // Verify NASA GIBS Satellite APIs use HTTPS
  assert(mapViewerCode.includes('https://gibs.earthdata.nasa.gov'), 'NASA GIBS satellite tiles must use HTTPS');
  assert(!mapViewerCode.includes('http://gibs.earthdata.nasa.gov'), 'Insecure HTTP forbidden for NASA GIBS');

  // Verify ThaiWater APIs (Stations & Dams) use HTTPS
  const waterServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/waterStationService.js'), 'utf-8');
  assert(waterServiceCode.includes('https://api-v3.thaiwater.net'), 'ThaiWater Station API must use HTTPS');
  assert(!waterServiceCode.includes('http://api-v3.thaiwater.net'), 'Insecure HTTP forbidden for ThaiWater');

  const damServiceCode = fs.readFileSync(path.join(rootDir, 'src/services/damService.js'), 'utf-8');
  assert(damServiceCode.includes('https://api-v3.thaiwater.net'), 'ThaiWater Dam API must use HTTPS');
  assert(!damServiceCode.includes('http://api-v3.thaiwater.net'), 'Insecure HTTP forbidden for Dam API');
});

// 4. Code Hygiene & Injection Vulnerability Scan
test('Source Code Hygiene: No eval, document.write, or unsanitized dangerous sinks', () => {
  const srcDir = path.join(rootDir, 'src');

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (file.endsWith('.js')) {
        const code = fs.readFileSync(fullPath, 'utf-8');
        assert(!code.includes('eval('), `Dangerous 'eval' found in ${file}`);
        assert(!code.includes('document.write('), `Dangerous 'document.write' found in ${file}`);
        assert(!code.includes('new Function('), `Dangerous 'new Function' found in ${file}`);
      }
    });
  }

  scanDir(srcDir);
});

// 5. Secret Leak Prevention
test('No Hardcoded Private Credentials or Secret Keys in Frontend', () => {
  const filesToCheck = ['package.json', 'vite.config.js', 'src/main.js', 'src/services/weatherService.js', 'src/services/nwpForecastService.js'];
  const sensitivePatterns = [/AIzaSy[0-9A-Za-z_-]{33}/, /ghp_[0-9a-zA-Z]{36}/, /BEGIN PRIVATE KEY/];

  filesToCheck.forEach((rel) => {
    const content = fs.readFileSync(path.join(rootDir, rel), 'utf-8');
    sensitivePatterns.forEach((regex) => {
      assert(!regex.test(content), `Potential secret/key pattern match detected in ${rel}`);
    });
  });
});

console.log(`\n🎉 Security Tests Completed: ${passedTests} passed.\n`);
