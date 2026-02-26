import { clientEntry } from "remix/component";
import { routes } from "~/routes.ts";

export const CancelButton = clientEntry(
    routes.assets.href({ file: "CancelButton", component: "CancelButton" }),
    function CancelButton() {
        return () => (
            <button
                on={{
                    click() {
                        navigation.back();
                    },
                }}
                type="button"
            >
                Cancel
            </button>
        );
    },
);
