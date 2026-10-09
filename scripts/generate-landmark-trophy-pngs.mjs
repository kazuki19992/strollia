/**
 * assets/achievements/spots/svg/ 配下の全SVGから、同名の透過PNG(600×600)を生成する。
 *
 * パックトロフィーの絵柄はSVGをマスタとして手書きし、プッシュ通知添付・汎用実績システムが
 * 要求する実ファイルのPNGはここで自動生成する(手作業でPNGを用意しない)。
 * パックJSONの内容には依存せず、SVGファイル名から機械的にPNGファイル名を決める。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svgDir = resolve(rootDir, 'assets/achievements/spots/svg');
const outputDir = resolve(rootDir, 'assets/achievements/spots');

const TROPHY_SIZE = 600;

const svgFiles = readdirSync(svgDir).filter((fileName) => fileName.endsWith('.svg'));

if (svgFiles.length === 0) {
  console.error(`SVGファイルが見つかりません: ${svgDir}`);
  process.exit(1);
}

await Promise.all(
  svgFiles.map(async (fileName) => {
    const svgPath = resolve(svgDir, fileName);
    const pngFileName = fileName.replace(/\.svg$/, '.png');
    const pngPath = resolve(outputDir, pngFileName);

    const svgBuffer = readFileSync(svgPath);
    const pngBuffer = await sharp(svgBuffer, { density: 300 })
      .resize(TROPHY_SIZE, TROPHY_SIZE)
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();

    writeFileSync(pngPath, pngBuffer);
    console.log(`トロフィーPNGを生成しました: ${pngPath}`);
  }),
);
