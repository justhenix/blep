#!/usr/bin/env node
/**
 * generate-error-logos.mjs
 *
 * Generates BLEP error-logo SVGs with isometric error codes (404, 403, 500, etc.)
 * printed on the cube face, matching the original eye geometry's perspective.
 *
 * Uses opentype.js to convert IBM Plex Mono Bold WOFF2 glyphs into SVG <path>
 * elements (no live <text>, so <img> embedding works perfectly).
 *
 * Usage:  node scripts/generate-error-logos.mjs
 * Output: static/logo-black-{400,401,403,404,429,500,503}.svg
 *         static/logo-w-{400,401,403,404,429,500,503}.svg
 *
 * Basically assets are so tedious to make manually. So I just write a script.
 * Illustrator is good enough but "yawn". Plus if I need to change font, colors,
 * sizes, position, I can just change the script. I'm a developer after all.
 * Don't be jelly :P
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { decompress } from 'wawoff2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// Load IBM Plex Mono Bold (700 weight) from local WOFF2
// WOFF2 must be decompressed to raw OTF/TTF before opentype.js can parse.
const fontPath = resolve(ROOT, 'static/fonts/ibm-plex-mono-700.woff2');
const woff2Buffer = readFileSync(fontPath);
const ttfUint8 = await decompress(woff2Buffer);
// wawoff2 returns a Uint8Array; opentype.js needs an ArrayBuffer
// Use slice to get a clean ArrayBuffer (not a view over a larger buffer)
const ttfArrayBuffer = ttfUint8.buffer.slice(
	ttfUint8.byteOffset,
	ttfUint8.byteOffset + ttfUint8.byteLength
);
const font = opentype.parse(ttfArrayBuffer);

console.log('[blep] loaded font:', font.names.fontFamily?.en || 'IBM Plex Mono');
console.log('[blep] unitsPerEm:', font.unitsPerEm);

// Scaffold SVG templates (cube outline, no eyes)
const blackScaffold = readFileSync(resolve(ROOT, 'static/logo-black-errs.svg'), 'utf-8');
const whiteScaffold = readFileSync(resolve(ROOT, 'static/logo-w-errs.svg'), 'utf-8');

// Geometry constants — derived from original eye positions
//
// The two eyes define the isometric plane on the right face of the cube.
//
// Left eye corners:
//      TL: 628.55, 573.09   TR: 702.27, 556.42
//      BR: 705.90, 644.48   BL: 632.18, 661.15
//
// Right eye corners:
//      TL: 781.11, 539.31   TR: 854.83, 522.63
//      BR: 858.46, 610.69   BL: 784.74, 627.36
//
// Face region (bounding the eyes with some margin):
//      x: ~580 to ~910,  y: ~470 to ~720
//
//    The isometric transform observed from the eye edges:
//      - Top edges slope upward-right: dy/dx ≈ (556.42 - 573.09) / (702.27 - 628.55)
//                                          ≈ -16.67 / 73.72 ≈ -0.226
//      - Left edges have a slight rightward lean:
//          dx/dy ≈ (632.18 - 628.55) / (661.15 - 573.09) ≈ 3.63 / 88.06 ≈ 0.041
//
//    So the affine matrix for the face plane is approximately:
//      | 1      0.041 |     or as SVG matrix(a,b,c,d,e,f):
//      | -0.226 1     |     matrix(1, -0.226, 0.041, 1, tx, ty)
//
//    We'll set tx, ty to center the text on the face.

// Face center — center of the right-face parallelogram
// Vertices: TL(514,390) TR(990,282) BR(994,874) BL(514,1031)
// Visual center of the parallelogram, slightly biased toward the eyes area
const FACE_CENTER_X = 753;
const FACE_CENTER_Y = 630;

// Target width for the 3-digit text block on the cube face (in SVG units)
const TARGET_WIDTH = 310;

// Isometric shear parameters
const SHEAR_Y = -0.226; // horizontal movement → vertical slope (upward right)
const SHEAR_X = 0.041; // vertical movement → horizontal lean (slight right)

// 4. Generate SVG path data for a text string
function getTextPaths(text, fontSize) {
	// opentype.js getPath gives us paths at a given position and size
	// We render at origin, then transform later
	const path = font.getPath(text, 0, 0, fontSize);
	return path.toPathData(2); // precision = 2 decimal places
}

/**
 * Compute the bounding box of a text string at a given font size.
 */
function getTextBBox(text, fontSize) {
	const path = font.getPath(text, 0, 0, fontSize);
	const bb = path.getBoundingBox();
	return {
		x: bb.x1,
		y: bb.y1,
		width: bb.x2 - bb.x1,
		height: bb.y2 - bb.y1,
		x2: bb.x2,
		y2: bb.y2
	};
}

/**
 * Find the right font size so that the text width matches TARGET_WIDTH.
 */
function computeFontSize(text, targetWidth) {
	// Start with a rough estimate and refine
	let fontSize = 200;
	let bbox = getTextBBox(text, fontSize);
	// Scale linearly
	fontSize = (targetWidth / bbox.width) * fontSize;
	return Math.round(fontSize * 10) / 10;
}

// 5. Build the <g> element with transformed text paths
function buildErrorGroup(errorCode, fillColor) {
	const text = String(errorCode);
	const fontSize = computeFontSize(text, TARGET_WIDTH);
	const pathData = getTextPaths(text, fontSize);
	const bbox = getTextBBox(text, fontSize);

	// Center the text on the face
	// The text paths are generated at origin (0,0 baseline).
	// We need to translate so the text center aligns with FACE_CENTER.
	const textCenterX = bbox.x + bbox.width / 2;
	const textCenterY = bbox.y + bbox.height / 2;

	// Translation to center the text at origin
	const cx = -textCenterX;
	const cy = -textCenterY;

	// Full SVG transform:
	// 1. Translate text center to origin: translate(cx, cy)
	// 2. Apply isometric shear: matrix(1, SHEAR_Y, SHEAR_X, 1, 0, 0)
	// 3. Translate to face center: translate(FACE_CENTER_X, FACE_CENTER_Y)
	//
	// Combined as a single SVG transform string (applied right-to-left):
	// translate(FACE_CENTER_X, FACE_CENTER_Y) matrix(1, SHEAR_Y, SHEAR_X, 1, 0, 0) translate(cx, cy)

	const transformStr = [
		`translate(${FACE_CENTER_X}, ${FACE_CENTER_Y})`,
		`matrix(1, ${SHEAR_Y}, ${SHEAR_X}, 1, 0, 0)`,
		`translate(${cx.toFixed(2)}, ${cy.toFixed(2)})`
	].join(' ');

	return `<g transform="${transformStr}"><path d="${pathData}" fill="${fillColor}"/></g>`;
}

// 6. Inject the error group into the scaffold SVG
function injectIntoScaffold(scaffold, errorGroup) {
	// Insert the error group just before </svg>
	return scaffold.replace('</svg>', `${errorGroup}\n</svg>`);
}

// 7. Generate all variants
const ERROR_CODES = [400, 401, 403, 404, 429, 500, 503];

for (const code of ERROR_CODES) {
	console.log(`[blep] generating error logos for ${code}...`);

	// Black variant
	const blackGroup = buildErrorGroup(code, '#000000');
	const blackSvg = injectIntoScaffold(blackScaffold, blackGroup);
	const blackPath = resolve(ROOT, `static/logo-black-${code}.svg`);
	writeFileSync(blackPath, blackSvg, 'utf-8');
	console.log(`  → ${blackPath}`);

	// White variant
	const whiteGroup = buildErrorGroup(code, '#FFFFFF');
	const whiteSvg = injectIntoScaffold(whiteScaffold, whiteGroup);
	const whitePath = resolve(ROOT, `static/logo-w-${code}.svg`);
	writeFileSync(whitePath, whiteSvg, 'utf-8');
	console.log(`  → ${whitePath}`);
}

console.log('[blep] done. all error logos generated.');
