/**
 * Generates favicon.ico and apple-touch-icon.png from public/favicon.svg.
 *
 * Usage: node scripts/generate-icons.mjs
 *
 * Requires: sharp (devDependency)
 * Output:   public/favicon.ico, public/apple-touch-icon.png
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const faviconSvg = readFileSync(path.join(publicDir, "favicon.svg"));

/**
 * Wraps one or more PNG buffers into a single ICO file.
 * ICO format: header (6 bytes) + directory entries (16 bytes each) + image data.
 */
function createIco(pngBuffers) {
	const count = pngBuffers.length;
	const headerSize = 6;
	const dirEntrySize = 16;
	const dirSize = dirEntrySize * count;
	let dataOffset = headerSize + dirSize;

	// Build directory entries
	const dirEntries = [];
	for (const png of pngBuffers) {
		// Parse PNG header for width/height (IHDR chunk starts at byte 16)
		const width = png.readUInt32BE(16);
		const height = png.readUInt32BE(20);

		const entry = Buffer.alloc(dirEntrySize);
		entry.writeUInt8(width >= 256 ? 0 : width, 0); // width (0 = 256)
		entry.writeUInt8(height >= 256 ? 0 : height, 1); // height (0 = 256)
		entry.writeUInt8(0, 2); // color palette count
		entry.writeUInt8(0, 3); // reserved
		entry.writeUInt16LE(1, 4); // color planes
		entry.writeUInt16LE(32, 6); // bits per pixel
		entry.writeUInt32LE(png.length, 8); // image data size
		entry.writeUInt32LE(dataOffset, 12); // offset to image data
		dirEntries.push(entry);
		dataOffset += png.length;
	}

	// ICO header
	const header = Buffer.alloc(headerSize);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: 1 = ICO
	header.writeUInt16LE(count, 4); // image count

	return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

async function renderPng(size) {
	return sharp(faviconSvg).resize(size, size).png().toBuffer();
}

async function main() {
	console.log("Generating icons from public/favicon.svg...");

	// Generate favicon.ico with 16x16 and 32x32 sizes
	const [png16, png32] = await Promise.all([renderPng(16), renderPng(32)]);

	const ico = createIco([png16, png32]);
	writeFileSync(path.join(publicDir, "favicon.ico"), ico);
	console.log(`  ✓ favicon.ico (${ico.length} bytes, 16x16 + 32x32)`);

	// Generate apple-touch-icon.png at 180x180
	const applePng = await renderPng(180);
	writeFileSync(path.join(publicDir, "apple-touch-icon.png"), applePng);
	console.log(`  ✓ apple-touch-icon.png (${applePng.length} bytes, 180x180)`);

	console.log("Done!");
}

main().catch((err) => {
	console.error("Icon generation failed:", err);
	process.exit(1);
});
