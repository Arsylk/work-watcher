import { match } from 'assert';
import { ExecException, exec as execRaw } from 'child_process';
import { PathLike } from 'fs';
import path from 'path';
import { exec, execResult } from './exec';
import { logger } from '.';
import { logFn } from './pico-logger';
import { execArgv } from 'process';
import * as Ncp from 'node:child_process';
import { Result } from './common';

const Patterns = {
    packageName: { type: 'single', regexp: /package: name='(.*?)'/ },
    versionName: { type: 'single', regexp: / versionName='(.*?)'/ },
    versionCode: { type: 'single', regexp: / versionCode='([0-9]*?)'/ },
    label: { type: 'single', regexp: /application: label='(.*?)'/ },
    icon: { type: 'single', regexp: /application:.*icon='(.*?)'/ },
    icons: { type: 'multiple', regexp: /application-icon-?.+:'(.+)'/g },
};

interface DumpBadging {
    packageName: string;
    versionName: string;
    versionCode: number;
    label: string;
    icon: string;
    icons: string[];
}

async function getDumpBadging(apk: string) {
    const command = `aapt2 dump badging "${apk}"`
    return execResult(command, parseDumpBadging);
    // return new Promise((resolve, reject) => {
    //     try {
    //         Ncp.execFile('/Users/krzysztofi/Library/Android/sdk/build-tools/34.0.0/aapt2', ['dump', 'badging', apk], function (error, stdout) {
    //             if (error !== null) {
    //                 reject(error);
    //             } else {
    //                 try {
    //                     const parsed = parseGetBadging(stdout);
    //                     resolve(parsed);
    //                 } catch (e) {
    //                     reject(e);
    //                 }
    //             }
    //         });
    //     } catch (e) {
    //         reject(e);
    //     }
    // });
}

function parseDumpBadging(out: string): DumpBadging {
    if (!out || out === '' || out.length === 0) throw Error("Output is empty")
    const keys = Object.keys(Patterns) as (keyof DumpBadging)[];

    const partial: { [key: string]: any } = {};
    for (const key of keys) {
        const { type, regexp } = Patterns[key];
        switch (type) {
            case 'single': {
                const item = out.match(regexp)?.[1];
                item && (partial[key] = item as any);
                break;
            }
            case 'multiple': {
                const data = [];
                for (const match of out.matchAll(regexp)) {
                    data.push(match[1]);
                }
                data.length > 0 && (partial[key] = data as any);
                break;
            }
        }
    }
    return partial as DumpBadging;
}

export { getDumpBadging, DumpBadging };
