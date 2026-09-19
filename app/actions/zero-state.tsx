export function ZeroState() {
    return () => (
        <div id="detail">
            <p id="zero-state">
                This is a demo for Remix 3.
                <br />
                Check out{" "}
                <a href="https://remix.run" rel="noopener" target="_blank">
                    the development at remix.run
                </a>
                .
            </p>
        </div>
    );
}
