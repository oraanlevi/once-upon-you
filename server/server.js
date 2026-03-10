import path from 'path';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import heicConvert from 'heic-convert';
import OpenAI, { toFile } from 'openai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5001);

if (!process.env.OPENAI_API_KEY) {
  console.warn('Missing OPENAI_API_KEY in server/.env');
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STANDARD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STANDARD_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];
const ORDER_STATUSES = ['new', 'in-production', 'completed', 'shipped'];
const SHOULD_CLEANUP_SESSION_AFTER_ORDER =
  String(process.env.CLEANUP_SESSION_AFTER_ORDER || 'true').toLowerCase() !== 'false';

function getFileExtension(filename = '') {
  return path.extname(filename).toLowerCase();
}

function getExtensionForMimeType(mimeType) {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function getContentTypeForExtension(extension) {
  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function sanitizeSessionId(value) {
  const input = String(value || '').trim();
  const safe = input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return safe || 'default';
}

function normalizePageIndex(value) {
  const parsed = Number.parseInt(String(value || '0'), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function getPageBaseName(pageIndex) {
  return `page-${String(pageIndex + 1).padStart(2, '0')}`;
}

function createOrderId() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `order-${stamp}-${rand}`;
}

function buildCustomerName(shipping = {}) {
  return [shipping.firstName, shipping.lastName].filter(Boolean).join(' ').trim();
}

async function readSortedFiles(dirPath, suffix = '') {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !suffix || name.endsWith(suffix))
    .sort((a, b) => a.localeCompare(b));
}

function isOriginalImageFile(filename) {
  return /^page-\d{2}-original\.(jpg|jpeg|png|webp)$/i.test(filename);
}

async function removeStaleOriginalsForPage(originalsDirectory, pageBaseName, keepExtension) {
  const entries = await fs.readdir(originalsDirectory, { withFileTypes: true }).catch(() => []);
  const keepName = `${pageBaseName}-original.${keepExtension}`;

  const staleFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (filename) =>
        isOriginalImageFile(filename) &&
        filename.startsWith(`${pageBaseName}-original.`) &&
        filename !== keepName,
    );

  await Promise.all(
    staleFiles.map((filename) =>
      fs.unlink(path.join(originalsDirectory, filename)).catch(() => {}),
    ),
  );
}

function isHeicFile(file) {
  const extension = getFileExtension(file.originalname);
  return HEIC_MIME_TYPES.includes(file.mimetype) || HEIC_EXTENSIONS.includes(extension);
}

function isSupportedUpload(file) {
  const extension = getFileExtension(file.originalname);

  if (STANDARD_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return true;
  }

  if (STANDARD_IMAGE_EXTENSIONS.includes(extension)) {
    return true;
  }

  if (isHeicFile(file)) {
    return true;
  }

  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (isSupportedUpload(file)) {
      callback(null, true);
      return;
    }

    callback(
      new Error('Please upload a JPG, JPEG, PNG, WebP, HEIC, or HEIF image.'),
    );
  },
});

app.use(
  cors({
    origin: 'http://localhost:5173',
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/coloring-page', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Image file is required.' });
      return;
    }

    console.log('POST /api/coloring-page', {
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    let imageBuffer = req.file.buffer;
    let imageName = req.file.originalname;
    let imageMimeType = req.file.mimetype;
    const sessionId = sanitizeSessionId(req.body?.sessionId);
    const pageIndex = normalizePageIndex(req.body?.pageIndex);

    if (isHeicFile(req.file)) {
      try {
        const converted = await heicConvert({
          buffer: imageBuffer,
          format: 'JPEG',
          quality: 0.9,
        });

        imageBuffer = Buffer.from(converted);
        imageMimeType = 'image/jpeg';
        imageName = `${path.parse(req.file.originalname).name}.jpg`;
      } catch (conversionError) {
        console.error('HEIC conversion error:', conversionError);
        res.status(400).json({
          error:
            'We could not process that HEIC/HEIF image. Please try another photo or export it as JPG.',
        });
        return;
      }
    }

    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const pageBaseName = getPageBaseName(pageIndex);
    const originalsExtension = getExtensionForMimeType(imageMimeType);
    const originalsMimeType = getContentTypeForExtension(originalsExtension);

    const orderDirectory = path.resolve(process.cwd(), 'generated-orders', `session-${sessionId}`);
    const originalsDirectory = path.join(orderDirectory, 'originals');
    const generatedDirectory = path.join(orderDirectory, 'generated');
    const cacheDirectory = path.resolve(process.cwd(), 'generated-orders', 'cache');
    const originalImagePath = path.join(
      originalsDirectory,
      `${pageBaseName}-original.${originalsExtension}`,
    );
    const generatedImagePath = path.join(
      generatedDirectory,
      `${pageBaseName}-generated.png`,
    );
    const pageHashPath = path.join(orderDirectory, `${pageBaseName}-original.sha256`);
    const globalCacheImagePath = path.join(cacheDirectory, `${imageHash}.png`);
    const globalCacheMetaPath = path.join(cacheDirectory, `${imageHash}.json`);

    await fs.mkdir(originalsDirectory, { recursive: true });
    await fs.mkdir(generatedDirectory, { recursive: true });
    await fs.mkdir(cacheDirectory, { recursive: true });

    const [existingHash, existingGeneratedBuffer, globalCachedBuffer] = await Promise.all([
      fs.readFile(pageHashPath, 'utf8').catch(() => null),
      fs.readFile(generatedImagePath).catch(() => null),
      fs.readFile(globalCacheImagePath).catch(() => null),
    ]);

    await removeStaleOriginalsForPage(originalsDirectory, pageBaseName, originalsExtension);
    await fs.writeFile(originalImagePath, imageBuffer);
    await fs.writeFile(pageHashPath, imageHash);
    await fs.writeFile(
      path.join(originalsDirectory, `${pageBaseName}.meta.json`),
      JSON.stringify(
        {
          originalName: imageName,
          mimeType: originalsMimeType,
          hash: imageHash,
        },
        null,
        2,
      ),
    );

    console.log('Coloring page cache check', {
      sessionId,
      page: pageIndex + 1,
      hasGenerated: Boolean(existingGeneratedBuffer?.length),
      hasHash: Boolean(existingHash),
    });

    // Reuse cached generated page whenever it already exists for this session/page.
    // If a hash file exists, we also verify it to guard against changed originals.
    const hashMatches = existingHash ? existingHash.trim() === imageHash : true;
    if (existingGeneratedBuffer?.length && hashMatches) {
      console.log(`Using cached generated image for page ${pageIndex + 1}`);
      res.json({
        imageBase64: existingGeneratedBuffer.toString('base64'),
        cached: true,
      });
      return;
    }

    if (globalCachedBuffer?.length) {
      console.log(`Global cache hit for image hash ${imageHash}`);
      await fs.writeFile(generatedImagePath, globalCachedBuffer);

      res.json({
        imageBase64: globalCachedBuffer.toString('base64'),
        cached: true,
      });
      return;
    }

    console.log(`Generating new coloring page for unseen hash ${imageHash}`);

    const prompt =
      "Turn this photo into a clean black-and-white children's coloring book page with bold outlines, simplified shapes, minimal fine details, no gray shading, white background, and large areas suitable for coloring.";

    const imageFile = await toFile(imageBuffer, imageName, {
      type: imageMimeType,
    });

    const result = await client.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt,
      size: '1024x1024',
    });

    const generatedBase64 = result?.data?.[0]?.b64_json;

    if (!generatedBase64) {
      res.status(502).json({ error: 'OpenAI did not return an image.' });
      return;
    }

    const generatedBuffer = Buffer.from(generatedBase64, 'base64');
    await Promise.all([
      fs.writeFile(generatedImagePath, generatedBuffer),
      fs.writeFile(globalCacheImagePath, generatedBuffer),
      fs.writeFile(
        globalCacheMetaPath,
        JSON.stringify(
          {
            hash: imageHash,
            createdAt: new Date().toISOString(),
            source: {
              originalName: imageName,
              mimeType: originalsMimeType,
            },
          },
          null,
          2,
        ),
      ),
    ]);

    console.log('Generated coloring page response', {
      outputLength: generatedBase64.length,
    });

    res.json({ imageBase64: generatedBase64, cached: false });
  } catch (error) {
    console.error('coloring-page error:', error);

    if (error?.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Max size is 10MB.' });
      return;
    }

    res.status(500).json({
      error: 'Failed to generate coloring page.',
      details: error?.message || 'Unknown error',
    });
  }
});

app.post('/api/orders/complete', async (req, res) => {
  try {
    const sessionId = sanitizeSessionId(req.body?.sessionId);
    const shipping = req.body?.shipping || {};
    const pageCount = Number.parseInt(String(req.body?.pageCount || '0'), 10) || 0;

    const sessionRoot = path.resolve(process.cwd(), 'generated-orders', `session-${sessionId}`);
    const sessionOriginals = path.join(sessionRoot, 'originals');
    const sessionGenerated = path.join(sessionRoot, 'generated');

    const [originalFilesRaw, generatedFiles] = await Promise.all([
      readSortedFiles(sessionOriginals),
      readSortedFiles(sessionGenerated, '-generated.png'),
    ]);
    const originalFiles = originalFilesRaw.filter(isOriginalImageFile);

    if (!originalFiles.length) {
      res.status(400).json({
        error: 'No original uploads found for this session.',
      });
      return;
    }

    if (!generatedFiles.length) {
      res.status(400).json({
        error: 'No generated pages found for this session. Please generate pages first.',
      });
      return;
    }

    const orderId = createOrderId();
    const orderRoot = path.resolve(process.cwd(), 'orders', orderId);
    const orderOriginals = path.join(orderRoot, 'originals');
    const orderGenerated = path.join(orderRoot, 'generated');

    await fs.mkdir(orderOriginals, { recursive: true });
    await fs.mkdir(orderGenerated, { recursive: true });

    await Promise.all([
      ...originalFiles.map((filename) =>
        fs.copyFile(
          path.join(sessionOriginals, filename),
          path.join(orderOriginals, filename),
        ),
      ),
      ...generatedFiles.map((filename) =>
        fs.copyFile(
          path.join(sessionGenerated, filename),
          path.join(orderGenerated, filename),
        ),
      ),
    ]);

    const createdAt = new Date().toISOString();
    const deliveryEstimate = req.body?.deliveryEstimate || '';
    const uploadedPhotoCount = originalFiles.filter((name) => name.includes('-original.')).length;

    const orderRecord = {
      orderId,
      createdAt,
      status: 'new',
      availableStatuses: ORDER_STATUSES,
      sessionId,
      pageCount,
      uploadedPhotoCount,
      firstName: shipping.firstName || '',
      lastName: shipping.lastName || '',
      email: shipping.email || '',
      address: shipping.address || '',
      city: shipping.city || '',
      postalCode: shipping.postalCode || '',
      country: shipping.country || '',
      customer: {
        name: buildCustomerName(shipping),
        email: shipping.email || '',
      },
      shipping: {
        firstName: shipping.firstName || '',
        lastName: shipping.lastName || '',
        email: shipping.email || '',
        address: shipping.address || '',
        city: shipping.city || '',
        postalCode: shipping.postalCode || '',
        country: shipping.country || '',
      },
      deliveryEstimate,
      files: {
        originals: originalFiles.map((name) => `originals/${name}`),
        generated: generatedFiles.map((name) => `generated/${name}`),
      },
    };

    await fs.writeFile(
      path.join(orderRoot, 'order.json'),
      JSON.stringify(orderRecord, null, 2),
      'utf8',
    );

    if (SHOULD_CLEANUP_SESSION_AFTER_ORDER) {
      try {
        await fs.rm(sessionRoot, { recursive: true, force: true });
        console.log('Cleaned temporary session folder after order completion', {
          sessionId,
          sessionRoot,
        });
      } catch (cleanupError) {
        console.warn('Order was saved, but temporary session cleanup failed', {
          sessionId,
          sessionRoot,
          error: cleanupError?.message || String(cleanupError),
        });
      }
    }

    console.log('Order saved for fulfillment', {
      orderId,
      sessionId,
      pageCount,
      generatedPages: generatedFiles.length,
    });

    res.status(201).json({
      orderId,
      createdAt,
      status: 'new',
      deliveryEstimate,
      files: orderRecord.files,
    });
  } catch (error) {
    console.error('order-complete error:', error);
    res.status(500).json({
      error: 'Failed to save completed order.',
      details: error?.message || 'Unknown error',
    });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'File too large. Max size is 10MB.' });
    return;
  }

  if (error?.message) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(port, () => {
  console.log(`Once Upon You backend listening on http://localhost:${port}`);
});
