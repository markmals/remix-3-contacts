import { createMetadataManager, withMetadataFrames } from "#/utils/metadata/index.ts";
import { createRoot, navigate, on, run } from "remix/ui";

createMetadataManager().hydrate(document);

// Must be registered before `run` so `event.preventDefault` works properly
//
// - Form submissions: GET via soft-navigate, utilizing the button[rmx-target] attribute
// - Form submissions: POST via fetch, then soft-navigate to the redirect URL
navigation.addEventListener("navigate", async event => {
    if (!event.canIntercept) return;

    // triggered programatically, handled by built-in listener
    if (!event.sourceElement) return;
    // anchors handled by built-in listener
    if (event.sourceElement.closest("a, area")) return;

    // sourceElement is <button type="submit"> inside of form submissions
    let target = event.sourceElement.getAttribute("rmx-target") ?? undefined;
    let src = event.sourceElement.getAttribute("rmx-src") ?? undefined;
    let resetScroll = event.sourceElement.hasAttribute("rmx-reset-scroll") ?? undefined;

    // Form POST submission — handle out-of-band so the URL only changes on success.
    if (event.formData) {
        event.preventDefault();

        let { destination, formData } = event;

        void (async () => {
            let response = await fetch(destination.url, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                let body = (await response.text()).trim();
                let message = body || `${response.status} ${response.statusText}`;
                let error = Object.assign(new Error(message), { status: response.status });
                app.dispatchEvent(new ErrorEvent("error", { error, message }));
                return;
            }

            navigate(response.url, { target, src, resetScroll });
        })();
        return;
    }

    // Form GET submission
    event.preventDefault();
    navigate(event.destination.url, { target, src, resetScroll });
});

let app = run({
    async loadModule(moduleUrl, exportName) {
        let mod = await import(/* @vite-ignore */ moduleUrl);
        let exported = mod[exportName];

        if (typeof exported !== "function") {
            throw new TypeError(
                `Expected export '${exportName}' from '${moduleUrl}' to be a function`,
            );
        }

        return exported;
    },
    resolveFrame: withMetadataFrames(async (src, signal, target) => {
        let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
        if (target) headers.set("x-remix-target", target);
        let response = await fetch(src, { headers, signal });
        return response.body ?? (await response.text());
    }),
});

// Global error boundary — renders a dismissible banner for any error
// dispatched on the app runtime, including failed POST submissions above.
let bannerHost = document.createElement("div");
document.body.insertBefore(bannerHost, document.body.firstChild);
let bannerRoot = createRoot(bannerHost);

function ErrorBanner() {
    return (props: { message: string }) => (
        <div id="app-error-banner" role="alert">
            <p>{props.message}</p>
            <button
                aria-label="Dismiss"
                mix={on("click", () => bannerRoot.render(null))}
                type="button"
            >
                ×
            </button>
        </div>
    );
}

app.addEventListener("error", event => {
    let message = event.message || String(event.error) || "Something went wrong.";
    bannerRoot.render(<ErrorBanner message={message} />);
});

// Must be registered after `run` (last intercept() call wins for focusReset).
navigation.addEventListener("navigate", event => {
    if (
        !event.canIntercept ||
        event.defaultPrevented ||
        // Only set focusReset for non-traverse navigations.
        // Traversals (back/forward) are handled by the built-in listener.
        event.navigationType === "traverse"
    ) {
        return;
    }

    // Set focusReset to prevent browser auto-reset
    // Important for search bar behavior
    event.intercept({ focusReset: "manual" });
});
