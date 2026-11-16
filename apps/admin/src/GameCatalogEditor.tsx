import { useEffect, useState } from "react";
import {
  beardStyles,
  bn,
  characterDefaults,
  hairStyles,
  itemOrder,
  rideNames,
  templates,
  themes,
  type CatalogAssetKind,
  type GameCatalog,
} from "@neta/shared";
import { worldAreas } from "../../../packages/shared/src/world-layout";

type Result = {
  draft: GameCatalog;
  publishedRevision: number;
  storage: "local" | "mongo";
  history: { id: string; at: string; revision: number; name: string }[];
  audit: { at: string; action: string; revision: number }[];
};
type Api = <T>(path: string, method?: string, data?: unknown) => Promise<T>;
const sections = {
  branding: "গেমের পরিচয়",
  characters: "চরিত্র ও পোশাক",
  map: "মানচিত্র ও অভিযান",
  rules: "জিনিস, পয়েন্ট ও যান",
  newspaper: "শেষের পত্রিকা",
  assets: "ছবি ও মডেল",
  history: "প্রকাশ ও ইতিহাস",
} as const;
const date = new Intl.DateTimeFormat("bn-BD", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
});
const errorText = (error: unknown) =>
  error instanceof Error && /\p{Script=Bengali}/u.test(error.message)
    ? error.message
    : "গেমের তালিকার সঙ্গে সংযোগ করা যায়নি। আবার চেষ্টা করুন।";

function Field({
  label,
  value,
  onChange,
  max = 120,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  max?: number;
}) {
  return (
    <label>
      {label}
      <input
        value={value}
        maxLength={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
function Choice<T extends string>({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: T;
  values: readonly [T, string][];
  onChange(value: T): void;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {values.map(([key, name]) => (
          <option key={key} value={key}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GameCatalogEditor({
  api,
  active,
  testMode,
}: {
  api: Api;
  active: boolean;
  testMode: boolean;
}) {
  const [data, setData] = useState<Result>();
  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState("");
  const [section, setSection] = useState<keyof typeof sections>("branding");
  const [characterId, setCharacterId] = useState("player");
  const [areaId, setAreaId] =
    useState<(typeof worldAreas)[number]["id"]>("promise-junction");
  const [kind, setKind] = useState<CatalogAssetKind>("image");
  const [file, setFile] = useState<File>();
  const [name, setName] = useState(""),
    [source, setSource] = useState("");
  const [rights, setRights] = useState(false),
    [uploadSequence, setUploadSequence] = useState(0);

  useEffect(() => {
    if (!active || data) return;
    let alive = true;
    void api<Result>("game-catalog")
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((error: unknown) => {
        if (alive) setNotice(errorText(error));
      });
    return () => {
      alive = false;
    };
  }, [api, active, data]);

  async function run(operation: () => Promise<Result>, message: string) {
    setBusy(true);
    setNotice("");
    try {
      setData(await operation());
      setDirty(false);
      setNotice(message);
      return true;
    } catch (error) {
      setNotice(errorText(error));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function change(edit: (draft: GameCatalog) => void) {
    setData((current) => {
      if (!current) return current;
      const draft = structuredClone(current.draft);
      edit(draft);
      return { ...current, draft };
    });
    setDirty(true);
  }
  const draft = data?.draft;
  const revision = draft?.revision;
  function assetChoices(type: CatalogAssetKind): [string, string][] {
    return [
      ["", "প্রকল্পের মূল সম্পদ"],
      ...(draft?.assets ?? [])
        .filter((asset) => asset.kind === type)
        .map((asset): [string, string] => [asset.id, asset.name]),
    ];
  }
  async function upload() {
    if (!file || !rights || !draft || dirty) return;
    const query = new URLSearchParams({
      kind,
      name,
      attribution: source,
      revision: String(revision),
    });
    const succeeded = await run(async () => {
      const response = await fetch("/api/admin/game-catalog/upload?" + query, {
        method: "POST",
        headers: { "X-Game-Rights": "confirmed" },
        body: file,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    }, "যাচাই করা ফাইল তালিকায় এসেছে। সেটি বেছে খসড়া সংরক্ষণ করুন।");
    if (succeeded) {
      setFile(undefined);
      setName("");
      setSource("");
      setRights(false);
      setUploadSequence((count) => count + 1);
    }
  }

  const character = draft?.characters[characterId];
  const area = draft?.areas[areaId];
  return (
    <section hidden={!active} className="catalog-editor">
      <header>
        <div>
          <p className="eyebrow">নেতা উঠছে! • প্রকাশনা ঘর</p>
          <h1>গেমের কনটেন্ট</h1>
          <p>
            {testMode && "পরীক্ষার পরিবেশ • "}প্রকাশিত সংস্করণ{" "}
            {bn(data?.publishedRevision ?? 0)} • খসড়া {bn(revision ?? 0)}
            {dirty && " • অসংরক্ষিত পরিবর্তন"}
            {data &&
              (data.storage === "mongo"
                ? " • আলাদা ডেটাবেস"
                : " • এই কম্পিউটারে সংরক্ষিত")}
          </p>
        </div>
        <div className="header-actions catalog-actions">
          <button
            disabled={busy || !dirty || !draft}
            onClick={() =>
              void run(
                () =>
                  api<Result>("game-catalog", "PUT", {
                    revision,
                    content: draft,
                  }),
                "খসড়া সংরক্ষিত হয়েছে।",
              )
            }
          >
            খসড়া সংরক্ষণ
          </button>
          {draft && !dirty && (
            <a
              className="catalog-preview-link"
              href="/?catalog=draft"
              target="_blank"
              rel="noreferrer"
            >
              খসড়া গেমে দেখুন ↗
            </a>
          )}
          <button
            className="primary"
            disabled={busy || dirty || !draft}
            onClick={() =>
              void run(
                () => api<Result>("game-catalog/publish", "POST", { revision }),
                "প্রকাশিত হয়েছে। গেম আবার খুললে নতুন সংস্করণ আসবে।",
              )
            }
          >
            গেম প্রকাশ করুন
          </button>
        </div>
      </header>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {!draft ? (
        <button
          disabled={busy}
          onClick={() =>
            void run(() => api("game-catalog"), "গেমের তালিকা এসেছে।")
          }
        >
          তালিকা আবার খুলুন
        </button>
      ) : (
        <>
          <nav className="catalog-tabs" aria-label="গেমের সম্পাদনা বিভাগ">
            {Object.entries(sections).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={section === key}
                onClick={() => setSection(key as keyof typeof sections)}
              >
                {label}
              </button>
            ))}
          </nav>
          <fieldset className="catalog-fields" disabled={busy}>
            {section === "branding" && (
              <>
                <legend>গেমের পরিচয়</legend>
                <Field
                  label="গেমের নাম"
                  max={44}
                  value={draft.branding.title}
                  onChange={(value) =>
                    change((d) => {
                      d.branding.title = value;
                    })
                  }
                />
                <Field
                  label="স্লোগান"
                  max={100}
                  value={draft.branding.slogan}
                  onChange={(value) =>
                    change((d) => {
                      d.branding.slogan = value;
                    })
                  }
                />
                <Choice
                  label="লোগো"
                  value={draft.branding.logo}
                  values={assetChoices("image")}
                  onChange={(value) =>
                    change((d) => {
                      d.branding.logo = value;
                    })
                  }
                />
                <Choice
                  label="দৃশ্যের রং"
                  value={draft.branding.theme}
                  values={
                    Object.entries(themes) as [keyof typeof themes, string][]
                  }
                  onChange={(value) =>
                    change((d) => {
                      d.branding.theme = value;
                    })
                  }
                />
              </>
            )}
            {section === "characters" && character && (
              <>
                <legend>চরিত্র ও পোশাক</legend>
                <Choice
                  label="চরিত্র বাছুন"
                  value={characterId}
                  values={characterDefaults.map(([id]) => [
                    id,
                    draft.characters[id].name,
                  ])}
                  onChange={setCharacterId}
                />
                <Field
                  label="চরিত্রের নাম"
                  max={44}
                  value={character.name}
                  onChange={(value) =>
                    change((d) => {
                      d.characters[characterId].name = value;
                    })
                  }
                />
                <Choice
                  label="পোশাকের ধরন"
                  value={character.template}
                  values={
                    Object.entries(templates) as [
                      keyof typeof templates,
                      string,
                    ][]
                  }
                  onChange={(value) =>
                    change((d) => {
                      d.characters[characterId].template = value;
                    })
                  }
                />
                <label>
                  পোশাকের রং
                  <input
                    type="color"
                    value={character.color}
                    onChange={(event) =>
                      change((d) => {
                        d.characters[characterId].color = event.target.value;
                      })
                    }
                  />
                </label>
                <NumberField
                  label="উচ্চতার গুণক"
                  value={character.height}
                  min={0.92}
                  max={1.08}
                  step={0.01}
                  onChange={(value) =>
                    change((d) => {
                      d.characters[characterId].height = value;
                    })
                  }
                />
                <NumberField
                  label="গড়নের গুণক"
                  value={character.build ?? 1}
                  min={0.92}
                  max={1.08}
                  step={0.01}
                  onChange={(value) =>
                    change((d) => {
                      d.characters[characterId].build = value;
                    })
                  }
                />
                <Choice
                  label="চুলের ধরন"
                  value={character.hair ?? "original"}
                  values={
                    Object.entries(hairStyles) as [
                      keyof typeof hairStyles,
                      string,
                    ][]
                  }
                  onChange={(value) =>
                    change((d) => {
                      d.characters[characterId].hair = value;
                    })
                  }
                />
                <Choice
                  label="গোঁফের ধরন"
                  value={character.beard ?? "original"}
                  values={
                    Object.entries(beardStyles) as [
                      keyof typeof beardStyles,
                      string,
                    ][]
                  }
                  onChange={(value) =>
                    change((d) => {
                      d.characters[characterId].beard = value;
                    })
                  }
                />
                <Choice
                  label="চরিত্রের ছবি"
                  value={character.portrait}
                  values={assetChoices("image")}
                  onChange={(value) =>
                    change((d) => {
                      d.characters[characterId].portrait = value;
                    })
                  }
                />
                <Choice
                  label="যাচাই করা ত্রিমাত্রিক মডেল"
                  value={character.model}
                  values={assetChoices("model")}
                  onChange={(value) =>
                    change((d) => {
                      d.characters[characterId].model = value;
                    })
                  }
                />
                <p>
                  কণ্ঠের জন্য পাশের “ঘটনার শব্দ ও কণ্ঠ” বিভাগে বাংলা নাম ও সংলাপ
                  দিন।
                </p>
              </>
            )}
            {section === "map" && area && (
              <>
                <legend>মানচিত্র ও অভিযান</legend>
                <Choice<typeof areaId>
                  label="এলাকা বাছুন"
                  value={areaId}
                  values={worldAreas.map(({ id }) => [
                    id,
                    draft.areas[id].name,
                  ])}
                  onChange={setAreaId}
                />
                <Field
                  label="এলাকার নাম"
                  max={32}
                  value={area.name}
                  onChange={(value) =>
                    change((d) => {
                      d.areas[areaId].name = value;
                    })
                  }
                />
                {areaId !== "promise-junction" && (
                  <Field
                    label="অভিযানের লক্ষ্য"
                    max={44}
                    value={area.target}
                    onChange={(value) =>
                      change((d) => {
                        d.areas[areaId].target = value;
                      })
                    }
                  />
                )}
                <Field
                  label="অভিযানের নির্দেশনা"
                  max={160}
                  value={area.objective}
                  onChange={(value) =>
                    change((d) => {
                      d.areas[areaId].objective = value;
                    })
                  }
                />
                <Field
                  label="চায়ের দোকানের নাম"
                  max={28}
                  value={area.tea}
                  onChange={(value) =>
                    change((d) => {
                      d.areas[areaId].tea = value;
                    })
                  }
                />
              </>
            )}
            {section === "rules" && (
              <>
                <legend>জিনিস, পয়েন্ট ও যান</legend>
                {itemOrder.map((id) => (
                  <div className="catalog-row" key={id}>
                    <Field
                      label={`${draft.items[id].name} • নাম`}
                      max={28}
                      value={draft.items[id].name}
                      onChange={(value) =>
                        change((d) => {
                          d.items[id].name = value;
                        })
                      }
                    />
                    <NumberField
                      label={`${draft.items[id].name} • পয়েন্ট`}
                      value={draft.items[id].score}
                      min={0}
                      max={100}
                      onChange={(value) =>
                        change((d) => {
                          d.items[id].score = value;
                        })
                      }
                    />
                    {id !== "hand" && (
                      <NumberField
                        label={`${draft.items[id].name} • কুড়ানোর পরিমাণ`}
                        value={draft.items[id].quantity}
                        min={1}
                        max={20}
                        onChange={(value) =>
                          change((d) => {
                            d.items[id].quantity = value;
                          })
                        }
                      />
                    )}
                  </div>
                ))}
                {(Object.keys(rideNames) as (keyof typeof rideNames)[]).map(
                  (id) => (
                    <div className="catalog-row" key={id}>
                      <Field
                        label={`${rideNames[id]} • নাম`}
                        max={34}
                        value={draft.vehicles[id].name}
                        onChange={(value) =>
                          change((d) => {
                            d.vehicles[id].name = value;
                          })
                        }
                      />
                      <NumberField
                        label={`${rideNames[id]} • গতির গুণক`}
                        value={draft.vehicles[id].speed}
                        min={0.55}
                        max={1.2}
                        step={0.01}
                        onChange={(value) =>
                          change((d) => {
                            d.vehicles[id].speed = value;
                          })
                        }
                      />
                    </div>
                  ),
                )}
                <div className="catalog-row">
                  {(
                    [
                      ["leader", "নেতা"],
                      ["worker", "কর্মী"],
                      ["civilian", "পথচারী"],
                    ] as const
                  ).map(([role, label]) => (
                    <NumberField
                      key={role}
                      label={`${label} • চলাফেরার গুণক`}
                      value={draft.behavior[role]}
                      min={0.65}
                      max={1.15}
                      step={0.01}
                      onChange={(value) =>
                        change((d) => {
                          d.behavior[role] = value;
                        })
                      }
                    />
                  ))}
                </div>
              </>
            )}
            {section === "newspaper" && (
              <>
                <legend>শেষের পত্রিকা</legend>
                {(
                  [
                    ["name", "পত্রিকার নাম"],
                    ["calm", "স্বাভাবিক শিরোনাম"],
                    ["disputed", "পথচারীর অভিযোগের শিরোনাম"],
                    ["photo", "ছবিসহ শিরোনাম"],
                    ["quote", "চায়ের দোকানের উদ্ধৃতি"],
                  ] as const
                ).map(([id, label]) => (
                  <Field
                    key={id}
                    label={label}
                    max={id === "name" ? 42 : 120}
                    value={draft.newspaper[id]}
                    onChange={(value) =>
                      change((d) => {
                        d.newspaper[id] = value;
                      })
                    }
                  />
                ))}
              </>
            )}
            {section === "assets" && (
              <>
                <legend>ছবি ও মডেল</legend>
                <Choice
                  label="ফাইলের ধরন"
                  value={kind}
                  values={[
                    ["image", "লোগো বা চরিত্রের ছবি"],
                    ["model", "রিগ ও অ্যানিমেশনসহ ত্রিমাত্রিক মডেল"],
                  ]}
                  onChange={(value) => {
                    setKind(value);
                    setFile(undefined);
                    setUploadSequence((count) => count + 1);
                  }}
                />
                <label>
                  ফাইল বাছুন
                  <input
                    key={uploadSequence}
                    type="file"
                    accept={
                      kind === "image"
                        ? "image/png,image/jpeg,image/webp"
                        : ".glb"
                    }
                    onChange={(event) => setFile(event.target.files?.[0])}
                  />
                </label>
                <Field
                  label="ফাইলের বাংলা নাম"
                  max={60}
                  value={name}
                  onChange={setName}
                />
                <Field
                  label="উৎস ও ব্যবহারের অনুমতি"
                  max={180}
                  value={source}
                  onChange={setSource}
                />
                <label className="catalog-rights">
                  <input
                    type="checkbox"
                    checked={rights}
                    onChange={(event) => setRights(event.target.checked)}
                  />
                  আমার এই ফাইল ব্যবহারের অনুমতি আছে
                </label>
                <button
                  disabled={!file || !rights || !name || !source || dirty}
                  onClick={() => void upload()}
                >
                  যাচাই করে ফাইল যোগ করুন
                </button>
                {dirty && <small>ফাইল যোগের আগে খসড়া সংরক্ষণ করুন।</small>}
                <ul className="catalog-assets">
                  {draft.assets.map((asset) => (
                    <li key={asset.id}>
                      {asset.kind === "image" && <img src={asset.url} alt="" />}
                      <strong>{asset.name}</strong>
                      <small>{asset.attribution}</small>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {section === "history" && (
              <>
                <legend>প্রকাশ ও ইতিহাস</legend>
                <p>আগের প্রকাশ ফিরিয়ে আনলে বর্তমান খসড়া রাখা হবে।</p>
                {[...(data?.history ?? [])].reverse().map((entry) => (
                  <div className="catalog-history" key={entry.id}>
                    <span>
                      {entry.name} • সংস্করণ {bn(entry.revision)} •{" "}
                      {date.format(new Date(entry.at))}
                    </span>
                    <button
                      disabled={dirty}
                      onClick={() =>
                        void run(
                          () =>
                            api<Result>("game-catalog/rollback", "POST", {
                              id: entry.id,
                              revision,
                            }),
                          "আগের প্রকাশ ফিরে এসেছে। গেম আবার খুলে দেখুন।",
                        )
                      }
                    >
                      এই প্রকাশ ফিরিয়ে আনুন
                    </button>
                  </div>
                ))}
                <h2>পরিবর্তনের রেকর্ড</h2>
                {[...(data?.audit ?? [])].reverse().map((entry) => (
                  <p key={entry.revision}>
                    {entry.action} • সংস্করণ {bn(entry.revision)} •{" "}
                    {date.format(new Date(entry.at))}
                  </p>
                ))}
              </>
            )}
          </fieldset>
        </>
      )}
    </section>
  );
}
