import fs from 'fs/promises';
import { DumpBadging } from './aapt2';
import { exec, execResult } from './exec';
import * as fsu from './files' 
import { spawn } from 'node:child_process';
import { Result } from './common';

function countChars(str: string, char: string): number {
    let count = 0;
    for (const c of str) {
        if (c === char) count += 1;
    }
    return count;
}

async function decode(apk: string): Promise<Result<string, Error>> {
    const [parsed, path] = fsu.pathify(apk);
    const outDir = fsu.join(parsed.dir, parsed.name);
    const command = `apktool d -f -s "${path}" -o "${outDir}"`; // TODO hard override add config
    return execResult(command,() => outDir);
    // await execOk(command);
    // return outDir;
}

async function findIconFile(data: DumpBadging, dir: string): Promise<string | null> {
    const names = [data.icon, ...data.icons]
        .map((s) => {
            const [parsed] = fsu.pathify(s ?? '');
            return parsed.ext === '.xml' ? parsed.name : parsed.base;
        })
        .reduce<string[]>((prev, item) => {
            if (!prev.includes(item)) {
                prev.push(item);
            }
            return prev;
        }, []);
    const all = await fs.readdir(dir, { recursive: true, withFileTypes: true });
    const found: { order: number; data: any }[] = [];
    for (const file of all) {
        const [parsed, path] = fsu.pathify(fsu.join(file.path, file.name));
        if (parsed.ext === '.xml') continue;

        if (names.includes(parsed.base)) {
            found.push({ order: 0, data: path });
            continue;
        }
        if (names.includes(parsed.name)) {
            found.push({ order: 1, data: path });
            continue;
        }
        if (parsed.base === 'ic_launcher.png' || parsed.base === 'ic_launcher.webm') {
            found.push({ order: 2, data: path });
            continue;
        }
        if (parsed.name.includes('ic_launcher') && (parsed.ext === '.png' || parsed.ext === '.webm')) {
            found.push({ order: 3, data: path });
            continue;
        }
    }
    found.sort((x, y) => {
        if (x.order === y.order) {
            return countChars(y.data, 'x') - countChars(x.data, 'x');
        }
        return x.order - y.order;
    });
    return found[0]?.data ?? null;
}

async function merge(dir: string): Promise<Result<string, Error>> {
    const [parsed, path] = fsu.pathify(dir);
    const outApk = fsu.join(parsed.dir, `${parsed.base}.merged`);
    const command = `APKEditor m -f -quiet -i "${path}" -o "${outApk}"`; // TODO hard override add config
    return execResult(command, () => outApk);
}

async function reflutter(apk: string): Promise<string> {
    const ip = exec(
        'ifconfig',
        (buffer) => buffer.match(/inet (?!127.0.0.1)(\d+\.\d+\.\d+\.\d+) /i)?.[1] ?? null,
        () => null,
    );
    const promise = new Promise<string>((resolve, reject) => {
        const process = spawn(`reflutter`, [apk]);
        process.once('close', (code, signal) => {
            console.log('code', code);
            code !== 0 ? reject({ code: code }) : resolve('xxx');
        });
        process.stdin.setDefaultEncoding('utf-8');
        // process.send('1')

        let i = 0;
        process.stdout.setEncoding('utf-8');
        process.stdout.on('data', (data: string) => {
            if (data.trim().endsWith('[1/2]?')) {
                process.send({});
            }
        });
        process.stderr.setEncoding('utf-8');
        process.on('data', console.error);
        process.stderr.on('data', console.warn);
        setTimeout(reject, 15000);
    });
    return promise;
}
// setImmediate(async () => await reflutter('/Users/krzysztofi/Downloads/raw.apk'));
export { decode, findIconFile, merge };
