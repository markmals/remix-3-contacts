import { routes } from "#/routes.ts";

/** Detail-frame content for a contact id that matches no record. */
export function ContactNotFound() {
    return () => (
        <div id="detail">
            <p id="zero-state">
                That contact does not exist.
                <br />
                It may have been deleted. <a href={routes.home.href()}>Back to all contacts</a>.
            </p>
        </div>
    );
}
