import { ObjectEncodingOptions, OpenMode, PathLike } from 'fs';
import fs, { FileHandle } from 'fs/promises';
import fsPath, { ParsedPath } from 'path';

async function mkdir(path: string): Promise<boolean> {
    const isNotDir = await fs
        .access(path, fs.constants.F_OK)
        .then(() => false)
        .catch((error) => error.code === 'ENOENT');
    if (isNotDir) return fs.mkdir(path, { recursive: true }).then(() => true);
    return Promise.resolve(false);
}

async function exists(path: string): Promise<boolean> {
    return fs
        .access(path, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
}

async function isEmpty(path: string): Promise<boolean> {
    return fs.readdir(path, { recursive: false, withFileTypes: false }).then((items) => items.length === 0);
}

async function readdir(path: PathLike, options?: (ObjectEncodingOptions & { withFileTypes?: false | undefined; recursive?: boolean | undefined; }) | BufferEncoding | null | undefined): Promise<string[]> {
    return fs.readdir(path, options).catch(() => [])
}

async function readText(path: PathLike, encoding: BufferEncoding): Promise<string | null> {
    return fs.readFile(path, encoding).catch(() => null);
}

async function writeText(file :PathLike, data: string, encoding: BufferEncoding) {
    return fs.writeFile(file, data, encoding).then(() => true, () => false);
}

function pathify(path: string): [ParsedPath, string] {
    return [fsPath.parse(path), path];
}

function join(...paths: string[]): string {
    return fsPath.join(...paths);
}

function relative(from: string, to: string): string {
    return fsPath.relative(from, to);
}

function dirname(path: string): string {
    return fsPath.dirname(path);
}

export { mkdir, exists, isEmpty, readdir, readText, writeText, pathify, relative, join, dirname };
