import { clientEntry } from "remix/component";

export const CancelButton = clientEntry(
    "/assets/CancelButton.js#CancelButton",
    function CancelButton() {
        return () => (
            <button
                on={{
                    click() {
                        window.navigation.back();
                    },
                }}
                type="button"
            >
                Cancel
            </button>
        );
    },
);
