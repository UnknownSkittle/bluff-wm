import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BLUFF_ROOT = path.resolve(__dirname, 'bluff-compositor');
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface SourceFileEntry {
  path: string;
  size: number;
  language: string;
  content: string;
}

function detectLanguage(relPath: string): string {
  if (relPath.endsWith('.zig') || relPath.endsWith('.zon')) return 'zig';
  if (relPath.endsWith('.yaml') || relPath.endsWith('.yml')) return 'yaml';
  if (relPath.endsWith('.md')) return 'markdown';
  if (relPath.endsWith('.sh')) return 'bash';
  return 'text';
}

function collectBluffFiles(dir: string, baseDir: string, out: SourceFileEntry[]): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectBluffFiles(abs, baseDir, out);
    } else if (entry.isFile()) {
      const rel = path.relative(baseDir, abs).replaceAll('\\', '/');
      const content = fs.readFileSync(abs, 'utf8');
      out.push({
        path: rel,
        size: Buffer.byteLength(content, 'utf8'),
        language: detectLanguage(rel),
        content,
      });
    }
  }
}

function createTarHeader(fileName: string, fileSize: number, modeOctal: string): Buffer {
  const header = Buffer.alloc(512, 0);
  const nameBuf = Buffer.from(fileName, 'utf8');
  nameBuf.copy(header, 0, 0, Math.min(nameBuf.length, 100));

  header.write(modeOctal.padStart(7, '0') + '\0', 100, 8, 'ascii');
  header.write('0000000\0', 108, 8, 'ascii');
  header.write('0000000\0', 116, 8, 'ascii');
  header.write(fileSize.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
  header.write(mtime, 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');

  let checksum = 0;
  for (let i = 0; i < 512; i++) {
    checksum += header[i];
  }
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return header;
}

function buildTarGz(files: Array<{name: string; content: string; executable?: boolean}>): Buffer {
  const chunks: Buffer[] = [];
  for (const file of files) {
    const data = Buffer.from(file.content, 'utf8');
    const mode = file.executable ? '0000755' : '0000644';
    chunks.push(createTarHeader(file.name, data.length, mode));
    chunks.push(data);
    const remainder = data.length % 512;
    if (remainder !== 0) {
      chunks.push(Buffer.alloc(512 - remainder, 0));
    }
  }
  chunks.push(Buffer.alloc(1024, 0));
  return zlib.gzipSync(Buffer.concat(chunks), {level: 9});
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({limit: '1mb'}));

  app.get('/api/source', (_req, res) => {
    try {
      const files: SourceFileEntry[] = [];
      collectBluffFiles(BLUFF_ROOT, BLUFF_ROOT, files);
      res.json({
        project: 'bluff-compositor',
        author: 'Unknown_Skittle',
        language: 'Zig',
        files,
      });
    } catch (err) {
      res.status(500).json({error: 'Failed to read BLUFF source repository'});
    }
  });

  app.post('/api/export', (req, res) => {
    try {
      const files: SourceFileEntry[] = [];
      collectBluffFiles(BLUFF_ROOT, BLUFF_ROOT, files);

      const overrides: Record<string, string> =
        req.body && typeof req.body.overrides === 'object' && req.body.overrides !== null
          ? req.body.overrides
          : {};

      const archiveEntries = files.map((file) => {
        const overrideContent =
          typeof overrides[file.path] === 'string' ? overrides[file.path] : file.content;
        return {
          name: `bluff-compositor/${file.path}`,
          content: overrideContent,
          executable: file.path.endsWith('.sh'),
        };
      });

      const tarGz = buildTarGz(archiveEntries);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', 'attachment; filename="bluff-compositor.tar.gz"');
      res.send(tarGz);
    } catch (err) {
      res.status(500).json({error: 'Failed to package BLUFF archive'});
    }
  });

  app.get('/api/export', (_req, res) => {
    try {
      const files: SourceFileEntry[] = [];
      collectBluffFiles(BLUFF_ROOT, BLUFF_ROOT, files);
      const archiveEntries = files.map((file) => ({
        name: `bluff-compositor/${file.path}`,
        content: file.content,
        executable: file.path.endsWith('.sh'),
      }));
      const tarGz = buildTarGz(archiveEntries);
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', 'attachment; filename="bluff-compositor.tar.gz"');
      res.send(tarGz);
    } catch (err) {
      res.status(500).json({error: 'Failed to package BLUFF archive'});
    }
  });

  if (!IS_PROD) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BLUFF workbench listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
