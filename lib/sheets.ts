import { createSign } from "node:crypto";
import {
  type Farm,
  type Animal,
  type Investor,
  type Transaction,
  type Settings,
  type Movement,
  defaultSettings,
} from "./model.ts";
import { type Action } from "./actions.ts";
export const configured = () =>
  Boolean(
    process.env.GOOGLE_SHEETS_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY,
  );
let tokenCache: { token: string; expires: number } | undefined;
async function token() {
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const encode = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned =
    encode({ alg: "RS256", typ: "JWT" }) +
    "." +
    encode({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    });
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt =
    unsigned +
    "." +
    signer.sign(
      process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      "base64url",
    );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("Não foi possível autenticar a conta de serviço Google.");
  const data = await response.json();
  tokenCache = { token: data.access_token, expires: Date.now() + 3300000 };
  return tokenCache.token;
}
export async function sheets(path: string, body?: unknown) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(process.env.GOOGLE_SHEETS_ID!)}${path}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${await token()}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 403
        ? "Compartilhe a planilha com a conta de serviço como editor."
        : "Não foi possível acessar a planilha. Confira o ID, as abas e a conexão.",
    );
  return response.json();
}
// The retired column at index 6 remains reserved to preserve existing spreadsheet rows.
export const headers = {
  Animais: [
    "id",
    "tag",
    "sex",
    "born",
    "weight",
    "owner",
    "_reserved",
    "status",
  ],
  Participantes: ["id", "name", "color"],
  Lancamentos: [
    "id",
    "date",
    "kind",
    "category",
    "description",
    "amount",
    "investor",
  ],
  Configuracoes: ["chave", "valor"],
  Movimentacoes: [
    "id",
    "date",
    "kind",
    "animalId",
    "tag",
    "fromOwner",
    "toOwner",
    "amount",
    "note",
  ],
};
export async function readFarm(): Promise<Farm> {
  const ranges = [
    "Animais!A1:H10001",
    "Participantes!A1:C501",
    "Lancamentos!A1:G20001",
    "Configuracoes!A1:B50",
  ];
  const meta = await sheets("?fields=sheets.properties");
  const hasMovements = meta.sheets.some(
    (sheet: { properties: { title: string } }) =>
      sheet.properties.title === "Movimentacoes",
  );
  if (hasMovements) ranges.push("Movimentacoes!A1:I20001");
  const data = await sheets(
    "/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&" +
      ranges.map((r) => "ranges=" + encodeURIComponent(r)).join("&"),
  );
  const rows = (i: number) =>
    ((data.valueRanges[i].values ?? []) as unknown[][])
      .slice(1)
      .filter((r) => r[0]);
  const objects = (i: number, keys: string[]) =>
    rows(i).map((r) => Object.fromEntries(keys.map((k, j) => [k, r[j] ?? ""])));
  const settings = { ...defaultSettings };
  for (const [k, v] of rows(3)) {
    if (typeof k === "string" && k in settings) {
      const key = k as keyof Settings;
      if (key === "name" || key === "location") settings[key] = String(v);
      else settings[key] = Number(v);
    }
  }
  return {
    animals: objects(0, headers.Animais).map((a) => ({
      ...a,
      weight: Number(a.weight),
    })) as Animal[],
    investors: objects(1, headers.Participantes) as Investor[],
    transactions: objects(2, headers.Lancamentos).map((t) => ({
      ...t,
      amount: Number(t.amount),
    })) as Transaction[],
    settings,
    movements: hasMovements
      ? (objects(4, headers.Movimentacoes).map((m) => ({
          ...m,
          amount: Number(m.amount),
        })) as Movement[])
      : [],
  };
}
const cells = (values: unknown[]) => ({
  values: values.map((v) => ({
    userEnteredValue:
      typeof v === "number" ? { numberValue: v } : { stringValue: String(v) },
  })),
});
export async function writeAction(f: Farm, a: Action) {
  const meta = await sheets("?fields=sheets.properties");
  const ids = Object.fromEntries(
    meta.sheets.map((s: { properties: { title: string; sheetId: number } }) => [
      s.properties.title,
      s.properties.sheetId,
    ]),
  );
  let animalRows: unknown[][] | undefined;
  if (a.type === "status" || a.type === "transfer") {
    const raw = await sheets(
      "/values/" +
        encodeURIComponent("Animais!A1:H10001") +
        "?valueRenderOption=UNFORMATTED_VALUE",
    );
    animalRows = raw.values ?? [];
  }
  const requests = buildWriteRequests(f, a, ids, animalRows);
  await sheets(":batchUpdate", { requests });
}
export function buildWriteRequests(
  f: Farm,
  a: Action,
  ids: Record<string, number>,
  animalRows?: unknown[][],
): unknown[] {
  const requests: unknown[] = [];
  const append = (tab: keyof typeof headers, record: object) =>
    requests.push({
      appendCells: {
        sheetId: ids[tab],
        rows: [
          cells(headers[tab].map((k) => record[k as keyof typeof record])),
        ],
        fields: "userEnteredValue",
      },
    });
  if (a.type === "animals") {
    return a.data.animals.flatMap((animal, index) =>
      buildWriteRequests(
        f,
        { type: "animal", data: animal, movement: a.movements[index] },
        ids,
      ),
    );
  }
  if (a.type === "animal") append("Animais", a.data);
  if (a.type === "purchase") {
    append("Animais", a.data.animal);
    append("Lancamentos", a.transaction);
  }
  if (a.type === "investor") append("Participantes", a.data);
  if (a.type === "transaction") append("Lancamentos", a.data);
  if (a.type === "settings")
    requests.push({
      updateCells: {
        start: { sheetId: ids.Configuracoes, rowIndex: 1, columnIndex: 0 },
        rows: Object.entries(a.data).map(([k, v]) => cells([k, v])),
        fields: "userEnteredValue",
      },
    });
  if (a.type === "status" || a.type === "transfer") {
    const index = (animalRows ?? []).findIndex((row) => row[0] === a.data.id);
    if (index < 1)
      throw new Error("Animal não encontrado na planilha. Atualize os dados.");
    const current = animalRows![index],
      expectedOwner = a.type === "transfer" ? a.data.fromOwner : a.data.owner;
    if (current[7] !== "ativo" || current[5] !== expectedOwner)
      throw new Error("Animal ou proprietário já alterado. Atualize os dados.");
    requests.push({
      updateCells: {
        start: {
          sheetId: ids.Animais,
          rowIndex: index,
          columnIndex: a.type === "transfer" ? 5 : 7,
        },
        rows: [cells([a.type === "transfer" ? a.data.toOwner : a.data.status])],
        fields: "userEnteredValue",
      },
    });
    if (a.type === "status" && a.transaction)
      append("Lancamentos", a.transaction);
  }
  if ("movement" in a) {
    if (ids.Movimentacoes === undefined) {
      ids.Movimentacoes = Math.max(0, ...Object.values(ids)) + 1;
      requests.push({
        addSheet: {
          properties: {
            sheetId: ids.Movimentacoes,
            title: "Movimentacoes",
            gridProperties: { rowCount: 20001, columnCount: 10 },
          },
        },
      });
      requests.push({
        appendCells: {
          sheetId: ids.Movimentacoes,
          rows: [cells(headers.Movimentacoes)],
          fields: "userEnteredValue",
        },
      });
    }
    append("Movimentacoes", a.movement);
  }
  return requests;
}
export async function initialize() {
  const meta = await sheets("?fields=sheets.properties");
  const existing = new Set(
    meta.sheets.map(
      (s: { properties: { title: string } }) => s.properties.title,
    ),
  );
  const missing = Object.keys(headers).filter((k) => !existing.has(k));
  if (missing.length)
    await sheets(":batchUpdate", {
      requests: missing.map((title) => ({
        addSheet: {
          properties: {
            title,
            gridProperties: {
              rowCount:
                title === "Lancamentos" || title === "Movimentacoes"
                  ? 20001
                  : title === "Animais"
                    ? 10001
                    : 501,
              columnCount: Math.max(
                8,
                headers[title as keyof typeof headers].length,
              ),
            },
          },
        },
      })),
    });
  const data = [];
  for (const [title, keys] of Object.entries(headers)) {
    const current = await sheets(
      "/values/" +
        encodeURIComponent(
          `${title}!A1:${String.fromCharCode(64 + keys.length)}2`,
        ),
    );
    if (current.values?.length) continue;
    data.push({
      range: `${title}!A1`,
      values:
        title === "Configuracoes"
          ? [keys, ...Object.entries(defaultSettings)]
          : [keys],
    });
  }
  if (data.length)
    await sheets("/values:batchUpdate", { valueInputOption: "RAW", data });
}
