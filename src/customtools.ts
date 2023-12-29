import { exec, execResult } from './exec';
import * as fsu from './files';
import { R2COCOS, COCOSKEY, IL2CPP } from './config';
import { Result } from './common';
import * as prettier from 'prettier';

namespace Cocos2dx {
    export async function findNativeLibs(dir: string): Promise<string[]> {
        const all = await fsu.readdir(dir, { recursive: true, withFileTypes: false });
        return all
            .filter((file) => file.includes('arm64-v8a') && file.includes('coco') && file.endsWith('.so'))
            .map((file) => fsu.join(dir, file));
    }

    export async function r2cocos(lib: string, out: string): Promise<Result<string, Error>> {
        const json = fsu.join(out, 'cocos_offsets.json');
        const command = `r2cocos "${lib}" "${out}"`;
        return execResult(command).then((result) => {
            if (!result.ok) {
                return Promise.resolve(result);
            }
            return fsu.readText(json, 'utf-8').then((content) => {
                if (!content) {
                    return Err(new Error(`${json}: no such file or directory`));
                }
                return Ok(content);
            });
        });
    }

    export async function cocosKey(lib: string, out: string): Promise<Result<string[], Error>> {
        const command = `cocos-key "${lib}"`;
        return execResult(command, (buffer) =>
            buffer
                .trim()
                .split('\n')
                .filter((value) => value && value.length > 0),
        );
    }
}

namespace Il2Cpp {
    export async function dumpIl2Cpp(dir: string, out: string = fsu.join(fsu.dirname(dir), 'il2cpp')) {
        await fsu.mkdir(out);
        const lib = fsu.join(dir, 'lib/arm64-v8a/libil2cpp.so');
        const meta = fsu.join(dir, 'assets/bin/Data/Managed/Metadata/global-metadata.dat');
        const command = `${IL2CPP} "${lib}" "${meta}" "${out}"`;
        return execResult(
            command,
            () => true,
            (_, stderr) => (stderr?.includes('System.InvalidOperationException') && stderr?.includes('Console.Read') ? true : undefined),
        );
    }
}

namespace Tagging {
    export type Tag = 'cocos2dx' | 'unity' | 'flutter' | 'hermes' | 'cordova' | 'react';

    export async function getApkTags(dir: string): Promise<[Tag, string][]> {
        const tags: [Tag, string][] = [];
        const files = await fsu.readdir(dir, { recursive: true });
        for (const file of files) {
            if (file.includes('lib') && file.includes('coco') && file.endsWith('.so')) {
                tags.push(['cocos2dx', file]);
            }
            if (file.includes('libflutter')) {
                tags.push(['flutter', file]);
            }
            if (file.includes('cordova.js')) {
                tags.push(['cordova', file]);
            }
            if (file.includes('libhermes.so')) {
                tags.push(['hermes', file]);
            }
            if (file.includes('assets/index.android.bundle')) {
                tags.push(['react', file]);
            }
            if (
                file.includes('libunity.so') ||
                file.includes('libil2cpp.so') ||
                file.includes('data.unity3d') ||
                file.includes('global-metadata.dat')
            ) {
                tags.push(['unity', file]);
            }
        }
        return tags;
    }

    export async function setTags(file: string, tags: string[]): Promise<Result<void, Error>> {
        const strtags = tags.map((tag) => `<string>${tag}</string>`).join('');
        const command = `xattr -w com.apple.metadata:_kMDItemUserTags '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><array>${strtags}</array></plist>' '${file}'`;
        return execResult(command);
    }

    export async function getTags(file: string): Promise<Result<string[], Error>> {
        const command = `mdls -raw -name kMDItemUserTags "${file}"`;
        return execResult(command, (buffer: string) => {
            const data: string[] = [];
            const lines = buffer.split('\n');
            for (let i = 1; i < lines.length - 1; i++) {
                let tag = lines[i].trim();
                if (i < lines.length - 2) {
                    if (tag.charAt(tag.length - 1) === ',') {
                        tag = tag.substring(0, tag.length - 1);
                    }
                }
                data.push(tag);
            }
            return data.sort();
        });
    }
}

namespace Prettier {
    export async function writeAll(dir: string) {
        const files = await fsu.readdir(dir, { recursive: true });
        for (const file of files) {
            const info = await prettier.getFileInfo(file);
            if (info.inferredParser) {
                try {
                    const command = `prettier --write --parser ${info.inferredParser} "${fsu.join(dir, file)}"`
                    exec(command, function(buffer: string) {
                        const line = buffer.trim();
                        if (line.endsWith('(unchanged)')) {
                            console.log(`\x1b[31;1;4m${line}\x1b[0m`)
                        } else {
                            console.log(line)
                        }
                    })
                } catch(e: any) {

                }
            }
        }
    }
}

export { Cocos2dx, Il2Cpp, Tagging, Prettier };
