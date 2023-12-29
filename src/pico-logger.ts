import pino, { Logger as _Logger } from 'pino';
import pp, { PinoPretty, PrettyOptions, colorizerFactory } from 'pino-pretty';

type Logger<T extends string> = _Logger<T> & { log(this: _Logger, message?: any, ...optionalParams: any[]): void };

function thisLine(cwd: string): string | null {
    const e = new Error();
    const regex = /\((.*):(\d+):(\d+)\)$/;
    const match = regex.exec(e.stack?.split('\n')?.[3] ?? '');
    if (!match) return null;
    return `\x1b[36m${match[1].replace(`${cwd}/`, '')}\x1b[0m:\x1b[33m${match[2]}\x1b[0m:\x1b[33m${match[3]}\x1b[0m`;
}

//@ts-ignore
function logFn<T extends (...args: any) => any>(fn: T): T {
    function mixin(...args: Parameters<T>[]): ReturnType<T> {
        const retval = fn(...args);
        const ghetto = `${fn}`.split('{')[0]!.trim();
        if (retval instanceof Promise) {
            return retval.then(
                (value) => {
                    logger().info({ args: args, return: value }, ghetto);
                    return value;
                },
                (reason) => {
                    logger().info({ args: args, error: reason }, ghetto);
                    throw new Error(reason);
                },
            ) as any;
        } else {
            logger().info({ args: args }, ghetto);
        }
        return retval;
    }

    return mixin as T;
}

function assignLogger<T extends string = never>(logger: _Logger<T>): Logger<T> {
    const cwd = process.cwd();
    return Object.assign(logger, {
        log(this: Logger<T>, message?: any, ...optionalParams: any[]): void {
            const fn: (arg: any) => string = (arg) => {
                switch (typeof arg) {
                    case 'string':
                        return arg;
                    default:
                        return JSON.stringify(arg);
                }
            };
            const str = [message, ...optionalParams].map(fn).join(' ');
            this.info({ at: thisLine(cwd) }, str);
        },
    }) as any;
}

const cache: { [key: string]: any } = {};
function logger() {
    return (cache['logger'] ??= assignLogger(
        pino({
            transport: {
                target: './pico-logger',
            },
            timestamp: false,
        }),
    ));
}

const factory = colorizerFactory(true);
const formatter: PinoPretty.MessageFormatFunc = (log, messageKey) => {
    const msg = log[messageKey];
    const level = `${log['level']}`;
    const lineAt = log['at'] ? ` ${log['at']}` : '';

    return `\x1b[0m[\x1b[0m${factory(level)}${lineAt}\x1b[0m]\x1b[0m ${msg}`;
};
const prettifiers: Record<string, PinoPretty.Prettifier> = {
    level: (logLevel) => '',
};
export default (opts: PrettyOptions) =>
    pp({
        ...opts,
        customPrettifiers: prettifiers,
        messageFormat: formatter,
        ignore: 'pid,hostname,at',
        colorize: true,
        colorizeObjects: true,
    });
export { assignLogger, Logger, logger, logFn };
