export function getContactId(url: URL): string | null {
    return url.searchParams.get("id");
}
