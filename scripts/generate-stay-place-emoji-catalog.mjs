#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'src/features/stayPlaces/stayPlaceEmojiCatalog.generated.ts');
const TWEMOJI_ASSETS_DIRECTORY = path.join(PROJECT_ROOT, 'assets/stayPlaces/twemoji');

/**
 * 固定ピッカーのカテゴリごとに、Emojibaseのemojibaseプリセットで一意に解決するshortcodeを指定する。
 * `expectedHexcode` は辞書更新で対応先が変わった場合に生成を止めるための固定値である。
 */
const STAY_PLACE_EMOJI_SELECTIONS = [
  { category: 'home', shortcode: 'house', expectedHexcode: '1F3E0' },
  { category: 'office', shortcode: 'office', expectedHexcode: '1F3E2' },
  { category: 'briefcase', shortcode: 'briefcase', expectedHexcode: '1F4BC' },
  { category: 'school', shortcode: 'school', expectedHexcode: '1F3EB' },
  { category: 'hospital', shortcode: 'hospital', expectedHexcode: '1F3E5' },
  { category: 'shopping', shortcode: 'shopping_bags', expectedHexcode: '1F6CD' },
  { category: 'cafe', shortcode: 'coffee', expectedHexcode: '2615' },
  { category: 'restaurant', shortcode: 'fork_and_knife', expectedHexcode: '1F374' },
  { category: 'park', shortcode: 'national_park', expectedHexcode: '1F3DE' },
  { category: 'gym', shortcode: 'person_lifting_weights', expectedHexcode: '1F3CB' },
  { category: 'station', shortcode: 'station', expectedHexcode: '1F689' },
  { category: 'hotel', shortcode: 'hotel', expectedHexcode: '1F3E8' },
];

/**
 * Emojibase shortcode presetの値を常に配列として扱える形へ正規化する。
 *
 * @param {string | string[]} shortcodes - Emojibaseが返すshortcode値。
 * @returns {string[]}
 */
function normalizeShortcodes(shortcodes) {
  return Array.isArray(shortcodes) ? shortcodes : [shortcodes];
}

/**
 * 指定shortcodeをemojibaseプリセットだけから逆引きし、一意なhexcodeを返す。
 *
 * @param {Record<string, string | string[]>} shortcodePreset - emojibase shortcode preset。
 * @param {string} shortcode - 解決するshortcode。
 * @returns {string}
 */
function resolveUniqueHexcode(shortcodePreset, shortcode) {
  const matches = Object.entries(shortcodePreset)
    .filter(([, shortcodes]) => normalizeShortcodes(shortcodes).includes(shortcode))
    .map(([hexcode]) => hexcode);

  if (matches.length !== 1) {
    throw new Error(`Emojibase shortcode ${shortcode} must resolve to exactly one hexcode, received ${matches.length}.`);
  }

  return matches[0];
}

/**
 * 生成済みカタログに必要な日本語ラベルとUnicode文字列をEmojibaseデータから取得する。
 *
 * @param {Array<{ hexcode: string; label: string; emoji: string }>} emojiData - Emojibase日本語データ。
 * @param {string} hexcode - 取得する絵文字のhexcode。
 * @returns {{ label: string; unicode: string }}
 */
function findEmojiMetadata(emojiData, hexcode) {
  const emoji = emojiData.find((item) => item.hexcode === hexcode);

  if (!emoji || typeof emoji.label !== 'string' || typeof emoji.emoji !== 'string') {
    throw new Error(`Emojibase Japanese emoji metadata is missing for ${hexcode}.`);
  }

  return { label: emoji.label, unicode: emoji.emoji };
}

/**
 * Metroが静的に解析できる同梱Twemoji PNGが存在することを検証する。
 *
 * @param {string} hexcode - Twemojiアセット名に使うhexcode。
 * @returns {string}
 */
function assertTwemojiAsset(hexcode) {
  const fileName = `${hexcode.toLowerCase()}.png`;
  const assetPath = path.join(TWEMOJI_ASSETS_DIRECTORY, fileName);

  if (!fs.existsSync(assetPath) || fs.statSync(assetPath).size === 0) {
    throw new Error(`Twemoji asset is missing or empty: ${path.relative(PROJECT_ROOT, assetPath)}`);
  }

  return fileName;
}

/**
 * TypeScriptの静的Metro requireを含む固定カタログを組み立てる。
 *
 * @param {Array<{ hexcode: string; label: string; unicode: string; assetFileName: string }>} emojis - 生成対象の絵文字。
 * @returns {string}
 */
function createGeneratedCatalogSource(emojis) {
  const rows = emojis
    .map(
      (emoji) =>
        `  {\n    hexcode: ${JSON.stringify(emoji.hexcode)},\n    label: ${JSON.stringify(emoji.label)},\n    unicode: ${JSON.stringify(
          emoji.unicode,
        )},\n    asset: require(${JSON.stringify(`../../../assets/stayPlaces/twemoji/${emoji.assetFileName}`)}),\n  },`,
    )
    .join('\n');

  return `/**\n * Emojibaseのemojibase shortcode presetと日本語データから生成した固定Twemojiカタログ。\n * 手動編集せず、node scripts/generate-stay-place-emoji-catalog.mjs で再生成する。\n */\nimport type { ImageSourcePropType } from 'react-native';\n\nexport type GeneratedStayPlaceEmoji = {\n  hexcode: string;\n  label: string;\n  unicode: string;\n  asset: ImageSourcePropType;\n};\n\nexport const GENERATED_STAY_PLACE_EMOJIS: readonly GeneratedStayPlaceEmoji[] = [\n${rows}\n];\n`;
}

/** 固定カタログを再生成する。 */
async function main() {
  // shortcodeの逆引きには、他プリセットを混在させずemojibaseだけを使う。
  const shortcodePreset = JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, 'node_modules/emojibase-data/en/shortcodes/emojibase.json'), 'utf8'),
  );
  const japaneseEmojiData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'node_modules/emojibase-data/ja/data.json'), 'utf8'));
  const seenHexcodes = new Set();
  const emojis = STAY_PLACE_EMOJI_SELECTIONS.map((selection) => {
    const hexcode = resolveUniqueHexcode(shortcodePreset, selection.shortcode);

    if (hexcode !== selection.expectedHexcode) {
      throw new Error(
        `Emojibase shortcode ${selection.shortcode} changed from ${selection.expectedHexcode} to ${hexcode} for ${selection.category}.`,
      );
    }
    if (seenHexcodes.has(hexcode)) {
      throw new Error(`Duplicate stay-place emoji hexcode: ${hexcode}.`);
    }
    seenHexcodes.add(hexcode);

    const metadata = findEmojiMetadata(japaneseEmojiData, hexcode);
    return { hexcode, ...metadata, assetFileName: assertTwemojiAsset(hexcode) };
  });

  if (emojis.length !== 12) {
    throw new Error(`Stay-place emoji catalog must contain exactly 12 entries, received ${emojis.length}.`);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  const prettierOptions = (await prettier.resolveConfig(OUTPUT_PATH)) ?? {};
  const source = await prettier.format(createGeneratedCatalogSource(emojis), { ...prettierOptions, filepath: OUTPUT_PATH });
  fs.writeFileSync(OUTPUT_PATH, source, 'utf8');
  console.log(`Generated ${emojis.length} stay-place emoji entries at ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

await main();
