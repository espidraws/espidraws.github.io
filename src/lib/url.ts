const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function withBase(path: string): string {
    if (/^https?:\/\//.test(path)) {
        return path;
    }
    return `${basePath}${path}`;
}
