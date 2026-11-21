import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Invalid PORT in .env (expected 1-65535).');
  process.exit(1);
}
const url = 'http://127.0.0.1:' + port;
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root, stdio: ['ignore', 'pipe', 'inherit']
});
let output = '', opened = false, stopping = false;
child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  if (opened) return;
  output = (output + chunk).slice(-4096);
  if (!output.includes('SpecIt: ' + url + ' (')) return;
  opened = true;
  if (process.platform !== 'win32') {
    console.log('Open ' + url + ' in your browser.');
    return;
  }
  // URL is built only from a validated numeric port.
  const browser = spawn('cmd.exe', ['/d', '/c', 'start', '""', url], {
    windowsVerbatimArguments: true, windowsHide: true, stdio: 'ignore'
  });
  const fallback = () => console.log('Open ' + url + ' manually in your browser.');
  browser.on('error', fallback);
  browser.on('exit', code => { if (code !== 0) fallback(); });
});
const stop = () => {
  if (stopping) return;
  stopping = true;
  child.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('error', err => {
  console.error('Server could not start:', err.message);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = stopping ? 0 : (code ?? 1);
  if (!opened && !stopping) console.error('Server stopped before startup. Check the error above (e.g. port in use).');
});
