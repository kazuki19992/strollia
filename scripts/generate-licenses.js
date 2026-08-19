#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'src/ui/generated/ossLicenses.ts');

/** @typedef {{ id: string; name: string; version: string; licenses: string; repository: string | null; source: 'npm' | 'ios' | 'asset'; licenseText: string | null; noticeText: string | null }} OssLicenseEntry */

/** @type {OssLicenseEntry[]} 同梱した非npmアセットの帰属情報。 */
const STATIC_ASSET_LICENSES = [
  {
    id: 'asset:twemoji-graphics',
    name: 'Twemoji graphics',
    version: '14.1.2',
    licenses: 'CC-BY 4.0',
    repository: 'https://github.com/jdecked/twemoji',
    source: 'asset',
    licenseText:
      'Twemoji graphics © 2020 Twitter, Inc and other contributors. Licensed under CC-BY 4.0: https://creativecommons.org/licenses/by/4.0/.',
    noticeText: 'Twelve static PNG assets are bundled from Twemoji v14.1.2.',
  },
];

/**
 * Loads the license checker module.
 * @returns {object} The license checker module namespace.
 */
async function loadLicenseChecker() {
  return import('license-checker-rseidelsohn');
}

/**
 * `@scope/name@1.0.0` のようなキーをパッケージ名とバージョンに分ける。
 *
 * @param {string} packageKey - license-checkerが返すパッケージキー。
 * @returns {{ name: string; version: string }}
 */
function splitPackageKey(packageKey) {
  const separatorIndex = packageKey.lastIndexOf('@');

  return {
    name: packageKey.slice(0, separatorIndex),
    version: packageKey.slice(separatorIndex + 1),
  };
}

/**
 * 読み取り可能なライセンス/NOTICEファイルの本文を返す。
 *
 * @param {unknown} filePath - license-checkerが返すファイルパス。
 * @returns {string | null}
 */
function readOptionalTextFile(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return null;
  }

  try {
    return fs.readFileSync(filePath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

/**
 * npm依存のライセンス情報を生成用データへ変換する。
 *
 * @param {Record<string, any>} packageLicenses - license-checkerが返すパッケージ情報。
 * @returns {OssLicenseEntry[]}
 */
function normalizeNpmLicenses(packageLicenses) {
  return Object.entries(packageLicenses)
    .filter(([, info]) => !info.private)
    .map(([packageKey, info]) => {
      const { name, version } = splitPackageKey(packageKey);

      return {
        id: `npm:${packageKey}`,
        name,
        version,
        licenses: Array.isArray(info.licenses) ? info.licenses.join(', ') : String(info.licenses ?? 'UNKNOWN'),
        repository: typeof info.repository === 'string' ? info.repository : null,
        source: 'npm',
        licenseText: readOptionalTextFile(info.licenseFile),
        noticeText: readOptionalTextFile(info.noticeFile),
      };
    });
}

/**
 * CocoaPodsが生成するAcknowledgements plist候補を探す。
 *
 * @param {string} directoryPath - 探索開始ディレクトリ。
 * @returns {string[]}
 */
function findAcknowledgementPlists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  return fs.readdirSync(directoryPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return findAcknowledgementPlists(entryPath);
    }

    return /acknowledgements\.plist$/i.test(entry.name) ? [entryPath] : [];
  });
}

/**
 * XML plistのdict本文から指定keyのstring値を取り出す。
 *
 * @param {string} dictXml - dict要素の内側XML。
 * @param {string} key - plist key。
 * @returns {string | null}
 */
function readPlistStringValue(dictXml, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`<key>\\s*${escapedKey}\\s*</key>\\s*<string>([\\s\\S]*?)</string>`);
  const match = dictXml.match(pattern);

  return match ? decodeXmlEntities(match[1].trim()) : null;
}

/**
 * plist XMLで使われる最小限の実体参照を戻す。
 *
 * @param {string} value - XML文字列。
 * @returns {string}
 */
function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Collect iOS dependency license records from CocoaPods acknowledgement plists.
 *
 * @returns {OssLicenseEntry[]} The deduplicated iOS license entries found in the acknowledgement plists.
 */
function collectIosAcknowledgements() {
  const supportFilesPath = path.join(PROJECT_ROOT, 'ios/Pods/Target Support Files');
  const plistPaths = findAcknowledgementPlists(supportFilesPath);
  const entriesById = new Map();

  for (const plistPath of plistPaths) {
    const xml = fs.readFileSync(plistPath, 'utf8');
    const preferenceSpecifiersMatch = xml.match(/<key>\s*PreferenceSpecifiers\s*<\/key>\s*<array>([\s\S]*?)<\/array>/);

    if (!preferenceSpecifiersMatch) {
      continue;
    }

    const dicts = preferenceSpecifiersMatch[1].match(/<dict>([\s\S]*?)<\/dict>/g) ?? [];

    for (const dict of dicts) {
      const title = readPlistStringValue(dict, 'Title');
      const footerText = readPlistStringValue(dict, 'FooterText');

      if (!title || !footerText || title === 'Acknowledgements') {
        continue;
      }

      entriesById.set(`ios:${title}`, {
        id: `ios:${title}`,
        name: title,
        version: '',
        licenses: 'See license text',
        repository: null,
        source: 'ios',
        licenseText: footerText,
        noticeText: null,
      });
    }
  }

  return [...entriesById.values()];
}

/**
 * Combines npm, iOS, and bundled asset license entries for display in the app.
 *
 * @param {OssLicenseEntry[]} npmLicenses - License entries from npm packages.
 * @param {OssLicenseEntry[]} iosLicenses - License entries from native iOS dependencies.
 * @returns {OssLicenseEntry[]} The combined license entries sorted by name.
 */
function mergeOssLicenses(npmLicenses, iosLicenses) {
  return [...npmLicenses, ...iosLicenses, ...STATIC_ASSET_LICENSES].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Writes OSS license data as a generated TypeScript module.
 *
 * @param {OssLicenseEntry[]} licenses - License entries to include in the generated module.
 * @param {string} generatedAt - Timestamp recorded in the generated module.
 */
function writeTypeScriptOutput(licenses, generatedAt) {
  const source = `/**\n * OSSライセンス表示用の生成済みデータ。\n * 手動編集せず、npm run generate:licenses で再生成する。\n */\nexport type OssLicenseSource = 'npm' | 'ios' | 'asset';\n\nexport type OssLicenseEntry = {\n  id: string;\n  name: string;\n  version: string;\n  licenses: string;\n  repository: string | null;\n  source: OssLicenseSource;\n  licenseText: string | null;\n  noticeText: string | null;\n};\n\nexport const OSS_LICENSES_GENERATED_AT = ${JSON.stringify(generatedAt)};\n\nexport const OSS_LICENSES: OssLicenseEntry[] = ${JSON.stringify(licenses, null, 2)};\n`;

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, source, 'utf8');
}

/**
 * Generates the application's bundled OSS license data from production dependencies and native acknowledgements.
 */
async function main() {
  const checker = await loadLicenseChecker();
  const npmLicenses = await new Promise((resolve, reject) => {
    checker.init(
      {
        start: PROJECT_ROOT,
        production: true,
        excludePrivatePackages: true,
      },
      (error, packages) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(normalizeNpmLicenses(packages));
      },
    );
  });
  const iosLicenses = collectIosAcknowledgements();
  const licenses = mergeOssLicenses(npmLicenses, iosLicenses);

  writeTypeScriptOutput(licenses, new Date().toISOString());
  console.log(`Generated ${licenses.length} OSS license entries at ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  collectIosAcknowledgements,
  decodeXmlEntities,
  mergeOssLicenses,
  normalizeNpmLicenses,
  readPlistStringValue,
  splitPackageKey,
};
