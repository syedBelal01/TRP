const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function ensureSquarePng(inputPath) {
  const absoluteInput = path.resolve(inputPath);
  const buffer = fs.readFileSync(absoluteInput);
  const image = sharp(buffer);
  const metadata = await image.metadata();

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const size = Math.max(width, height);

  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);

  const squared = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  })
    .composite([{ input: buffer, left, top }])
    .png()
    .toBuffer();

  fs.writeFileSync(absoluteInput, squared);
  return { size };
}

(async () => {
  const input = process.argv[2] || './assets/images/app-logo.png';
  try {
    const result = await ensureSquarePng(input);
    console.log(`Squared image saved at ${path.resolve(input)} to ${result.size}x${result.size}`);
  } catch (err) {
    console.error('Failed to square image:', err);
    process.exit(1);
  }
})();


