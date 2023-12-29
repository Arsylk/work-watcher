import { ExecException, exec as rawExec } from 'node:child_process';
import { logger } from '.';
import { Result } from './common';
import { stderr } from 'process';

interface ExecError {
    error: Error | null;
    stderr: string | null;
}

async function exec(command: string): Promise<void>;
async function exec<T>(command: string, onSuccess: (buffer: string) => T): Promise<T>;
async function exec<T, R>(
    command: string,
    onSuccess?: (buffer: string) => T,
    onError?: (error: Error | null, stderr: string | null) => R,
): Promise<T | (R extends undefined ? never : R)>;
async function exec<T, R>(
    command: string,
    onSuccess?: (buffer: string) => T,
    onError?: (error: Error | null, stderr: string | null) => R,
): Promise<T | R> {
    return new Promise((resolve, reject) => {
        const _onError = (error: Error | null, stderr: string | null) => {
            try {
                const fallback = onError?.(error, stderr);
                if (fallback !== undefined) {
                    return resolve(fallback);
                }
                logger.error(error, `exec: ${command}`);
                return reject(error);
            } catch (e: any) {
                logger.error(e, `exec: ${command}`);
                return reject(e);
            }
        };
        try {
            logger.debug({ command: command }, 'exec...');
            rawExec(command, (error: ExecException | null, stdout: string, stderr: string) => {
                if (error) {
                    return _onError(error, stderr);
                }
                try {
                    return resolve(onSuccess?.(stdout) as T);
                } catch (e: any) {
                    return _onError(e, null);
                }
            });
        } catch (e: any) {
            _onError(e, null);
        }
    });
}

async function execOk(command: string): Promise<boolean> {
    return exec(
        command,
        () => true,
        () => false,
    );
}

async function execResult(command: string): Promise<Result<void, Error>>;
async function execResult<T>(command: string, onSuccess: (buffer: string) => T): Promise<Result<T, Error>>;
async function execResult<T, R>(
    command: string,
    onSuccess?: (buffer: string) => T,
    onError?: (error: Error | null, stderr: string | null) => R,
): Promise<Result<T | (R extends undefined ? never : R), Error>>;
async function execResult<T, R>(
    command: string,
    onSuccess?: (buffer: string) => T,
    onError?: (error: Error | null, stderr: string | null) => R,
): Promise<Result<T | R, Error>> {
    return exec(command, onSuccess, onError).then(
        (value) => Ok(value),
        (reason) => Err(reason),
    );
}

export { exec, execOk, execResult };
