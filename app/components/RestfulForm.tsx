import type { RequestMethod } from "remix/router";

export function RestfulForm() {
    return ({
        children,
        method,
        ...props
    }: JSX.IntrinsicHTMLElements["form"] & { method?: RequestMethod | "ANY" }) => {
        let isGET = method === "GET" || typeof method === "undefined";
        return (
            <form method={isGET ? "GET" : "POST"} {...props}>
                {!isGET && <input name="_method" type="hidden" value={method} />}
                {children}
            </form>
        );
    };
}
