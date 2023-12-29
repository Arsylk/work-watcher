import './common';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import extract from 'extract-zip';
import { DOWNLOADS, WORKSPACE } from './config';
import { DumpBadging, getDumpBadging } from './aapt2';
import { merge, findIconFile, decode } from './apktools';
import * as fsu from './files';
import { execOk } from './exec';
import { Logger as _Logger } from 'pino';
import { logger as l } from './pico-logger';
import { Cocos2dx, Il2Cpp, Tagging, Prettier } from './customtools';
import { Result } from './common';

export const logger = l();
logger.log('hi !~');

setTimeout(async () => {
    await Prettier.writeAll('/Users/krzysztofi/Workspace/de.mgs.axa.external-2023073053');
});

// Downloads to workspace
const watcher = chokidar.watch([`${DOWNLOADS}/download-*.apk`, `${DOWNLOADS}/download-*.zip`], {
    persistent: true,
    ignoreInitial: true,
    depth: 0,

    usePolling: false,
    interval: 100,
    binaryInterval: 300,
    alwaysStat: false,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
    },

    ignorePermissionErrors: false,
    atomic: true,
});
watcher.on('add', async (rawpath) => {
    const [parsed, path] = fsu.pathify(rawpath);
    if (parsed.dir !== DOWNLOADS) return;
    logger.log('download:', fsu.relative(DOWNLOADS, path));

    if (parsed.ext === '.apk') {
        const target = fsu.join(WORKSPACE, ququename(parsed.base));
        if (await fsu.exists(target)) return;
        await fs.rename(path, target);
        return;
    }

    if (parsed.ext === '.zip') {
        const target = fsu.join(DOWNLOADS, parsed.name);
        if (await fsu.exists(target)) return;

        const filesOut: string[] = [];
        await extract(path, {
            dir: target,
            onEntry: (entry) => {
                if (entry.fileName.endsWith('.apk')) {
                    filesOut.push(entry.fileName);
                }
            },
        });

        if (filesOut.length === 1) {
            const fileName = filesOut[0];
            const workspaceTarget = fsu.join(WORKSPACE, ququename(fileName));
            if (await fsu.exists(workspaceTarget)) return;
            await fs.rename(fsu.join(target, fileName), workspaceTarget);
            if (await fsu.isEmpty(target)) await fs.rmdir(target);
            return;
        }

        if (filesOut.length > 1) {
            const workspaceDir = fsu.join(WORKSPACE, ququename(`${Date.now()}`));
            await fs.rename(target, workspaceDir);
            return;
        }
    }
});

function ququename(name: string): string {
    return `#${name}`;
}
function apkname(data: DumpBadging): string {
    return `${data.label}.apk`;
}
function foldername(data: DumpBadging): string {
    return `${data.packageName}-${data.versionCode}`;
}

const workspaceApkWatcher = chokidar.watch([`${WORKSPACE}/#*.apk`], {
    persistent: true,
    ignoreInitial: false,
    depth: 0,
});
const workspaceDirWatcher = chokidar.watch([`${WORKSPACE}/#*`], {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
});

workspaceApkWatcher.on('add', async (rawpath) => {
    const [parsed, path] = fsu.pathify(rawpath);
    if (parsed.dir !== WORKSPACE) return;
    logger.log('add file:', fsu.relative(WORKSPACE, path));

    const result = await getDumpBadging(path);
    if (!result.ok) {
        logger.error(result.error, `could not aapt2 dump badging: ${path}`);
        return;
    }

    const data = result.value;
    const outDir = fsu.join(WORKSPACE, foldername(data));
    const outApk = fsu.join(outDir, apkname(data));

    await fsu.mkdir(outDir);
    if (await fsu.exists(outApk)) await fs.rm(outApk); // TODO hard override add config
    await fs.rename(path, outApk);

    await performUnpack(outDir, outApk, data);
    logger.info({ folder: outDir }, 'finished !~');
});

workspaceDirWatcher.on('addDir', async (rawpath) => {
    const [parsed, path] = fsu.pathify(rawpath);
    if (parsed.dir !== WORKSPACE) return;
    logger.info(`add dir: ${fsu.relative(WORKSPACE, path)}`);

    logger.info({ path: path }, `APKEditor merge...`);
    const outMerge = await merge(path);
    if (!outMerge.ok) {
        logger.error(outMerge.error, `could not merge: ${path}`);
        return;
    }

    logger.info({ file: outMerge.value }, `aapt2 dump badging...`);
    const apkData = await getDumpBadging(outMerge.value);
    if (!apkData.ok) {
        logger.error(apkData.error, `could not aapt2 dump badging: ${outMerge.value}`);
        return;
    }

    const outDir = fsu.join(WORKSPACE, foldername(apkData.value));
    const outApk = fsu.join(outDir, apkname(apkData.value));
    const outSplits = fsu.join(outDir, 'splits');

    await fsu.mkdir(outDir);
    if (await fsu.exists(outApk)) await fs.rm(outApk); // TODO hard override add config
    await fs.rename(outMerge.value, outApk);
    if (await fsu.exists(outSplits)) await fs.rm(outSplits, { recursive: true }); // TODO hard override add config
    await fs.rename(path, outSplits);

    await performUnpack(outDir, outApk, apkData.value);
    logger.info({ folder: outDir }, 'finished !~');
});

async function performUnpack(dir: string, apk: string, data: DumpBadging) {
    logger.info({ apk: apk }, `apktool decode...`);
    const unpackDir = await decode(apk);
    if (!unpackDir.ok) {
        logger.error(unpackDir.error, `could not apktool decode: ${apk}`);
        return;
    }

    const iconfile = await findIconFile(data, unpackDir.value);
    logger.info({ file: iconfile }, `icon`);
    if (iconfile) {
        await execOk(`fileicon set "${dir}" "${iconfile}"`);
    }

    const tags: string[] = [];
    const tagged = await Tagging.getApkTags(unpackDir.value);
    for (const [tag, file] of tagged) {
        if (!tags.includes(tag)) {
            tags.push(tag);
        }
    }
    tags.sort();
    await Tagging.setTags(dir, tags);

    // unity flow
    if (tags.includes('unity')) {
        logger.info({ apk: apk }, `il2cpp dump...`);
        const il2cpp = await Il2Cpp.dumpIl2Cpp(unpackDir.value);
        if (!il2cpp.ok) {
            logger.error(il2cpp.error, `could not il2cpp dump: ${unpackDir.value}`);
        }
    }

    // cocos2dx flow
    if (tags.includes('cocos2dx')) {
        const libs = await Cocos2dx.findNativeLibs(unpackDir.value);
        for (const lib of libs) {
            logger.info({ lib: lib }, 'r2cocos...');
            const disassemble = await Cocos2dx.r2cocos(lib, unpackDir.value);
            if (!disassemble.ok) {
                logger.warn(disassemble.error, `could not r2cocos: ${lib}`);
            } else {
                logger.info({ lib: lib }, disassemble.value);
            }
            logger.info({ lib: lib }, 'cocos-key...');
            const cocosKey = await Cocos2dx.cocosKey(lib, unpackDir.value);
            if (!cocosKey.ok) {
                logger.warn(cocosKey.error, `could not cocos-key: ${unpackDir.value}`);
            } else {
                logger.info({ lib: lib, keys: cocosKey.value }, 'cocos-key');
            }
        }
    }
}
