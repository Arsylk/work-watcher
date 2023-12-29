type Result<T, E = undefined> = { ok: true; value: T } | { ok: false; error: E | undefined };

const Ok = <T>(data: T): Result<T, never> => {
    return { ok: true, value: data };
};

const Err = <E>(error?: E): Result<never, E> => {
    return { ok: false, error };
};

declare global {
    const Ok: <T>(data: T) => Result<T, never>;
    const Err: <E>(error?: E) => Result<never, E>;
}

Object.assign(global, {
    Ok: Ok,
    Err: Err,
});

export { Result }