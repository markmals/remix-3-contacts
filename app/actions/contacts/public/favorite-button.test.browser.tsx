import { FavoriteButton } from "#/actions/contacts/public/favorite-button.tsx";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

describe("FavoriteButton", () => {
    it("shows the current state but submits the desired one", (t: {
        after(fn: () => void): void;
    }) => {
        // A native submission has no JavaScript to flip anything, and
        // updateContact writes an absolute value rather than toggling. So the
        // value the button carries has to be the state the user wants next,
        // while the glyph still reflects the state they have now.
        let favorited = render(<FavoriteButton contactId={1} favorite={true} />);
        t.after(favorited.cleanup);

        assert.equal(favorited.$("button")?.getAttribute("value"), "false");
        assert.equal(favorited.$("button")?.textContent, "★");

        let plain = render(<FavoriteButton contactId={1} favorite={false} />);
        t.after(plain.cleanup);

        assert.equal(plain.$("button")?.getAttribute("value"), "true");
        assert.equal(plain.$("button")?.textContent, "☆");
    });

    it("posts to the contact's favorite route with a method override", () => {
        // RestfulForm renders POST plus a hidden _method, which methodOverride()
        // turns back into the PATCH the route declares.
        let result = render(<FavoriteButton contactId={7} favorite={false} />);

        let form = result.$("form") as HTMLFormElement | null;
        assert.equal(form?.getAttribute("method")?.toUpperCase(), "POST");
        assert.ok(form?.getAttribute("action")?.endsWith("/contacts/7/favorite"));
        assert.equal(result.$('input[name="_method"]')?.getAttribute("value"), "PATCH");

        result.cleanup();
    });
});
