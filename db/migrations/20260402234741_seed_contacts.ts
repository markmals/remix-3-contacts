import { Contacts } from "#db/contacts.ts";
import { createMigration } from "remix/data-table/migrations";

const SEED_CONTACTS = [
    {
        first: "Brooks",
        last: "Lybrand",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:l7sltcx6yitxew2vgcrn72ge/bafkreibg6v7njo3pxsmzxa262j6ikw4i66umygdawz5iduuu3h4tfyprbm@jpeg",
        bsky: "brookslybrand.bsky.social",
    },
    {
        first: "Mark",
        last: "Dalgleish",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:hucjy724rz245jjd3ismnwcy/bafkreifecuk7zywjcxraqr75ua7hp3jtj2g5zygifh3cmzbe3hpsnqr7ye@jpeg",
        bsky: "markdalgleish.com",
    },
    {
        first: "Pedro",
        last: "Cattori",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:6zwkx24n4vucdcfgzbwzfy57/bafkreihecdr73d63xajbsrr525j7mih4dymzc5scaz7fr6qtyuouenrheu@jpeg",
        bsky: "pedrocattori.com",
    },
    {
        first: "Kent C.",
        last: "Dodds",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:xzefkiajzjmmyp6zq6ftczg3/bafkreicjzokch3d33ikmot252ilfmlzfnqv6vbhonzcftdslmql3db5tfm@jpeg",
        bsky: "kentcdodds.com",
    },
    {
        first: "Jacob",
        last: "Ebey",
        avatar: "https://cdn.bsky.app/img/avatar/plain/did:plc:twegdcgytckr5cxm57gyruxa/bafkreidx3bmu6wprocniiyrpwnpwljky6rat7bjccxxoc66ncybhzt5qxu@jpeg",
        bsky: "ebey.bsky.social",
    },
];

export default createMigration({
    async up({ db }) {
        let count = await db.count(Contacts);
        if (count > 0) return;

        for (let contact of SEED_CONTACTS) {
            await db.create(Contacts, {
                first: contact.first,
                last: contact.last,
                avatar: contact.avatar,
                bsky: contact.bsky,
                notes: "",
                favorite: false,
                createdAt: `${Date.now()}`,
            });
        }
    },
    async down({ db }) {
        await db.deleteMany(Contacts, { where: {} });
    },
});
