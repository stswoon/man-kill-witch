#!/usr/bin/env node
// ElevenLabs voice catalog and speech generation for game voice lines.
// Reads ELEVENLABS_API_KEY from the local .env; never prints or logs the key.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  WEEKLY_BUDGET_USD,
  computeBudget,
  countCharacters,
  emptyLedger,
  normalizeLedger,
  round6,
  weekStatus,
} from "./voice-budget.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL = "eleven_v4";
const DEFAULT_FORMAT = "mp3_44100_128";
const DEFAULT_OUT_DIR = join(ROOT, "work", "voice");
const LEDGER_PATH = join(DEFAULT_OUT_DIR, "spend.json");
const MAX_TEXT = 10000;
const MAX_TEXT_BY_MODEL = {
  eleven_v3: 5000,
  eleven_flash_v2_5: 40000,
};
// Used when the API key has no models_read permission.
const DOCUMENTED_MODELS = [
  { model_id: "eleven_v4", name: "Eleven v4", can_do_text_to_speech: true },
  { model_id: "eleven_v4_turbo", name: "Eleven v4 Turbo", can_do_text_to_speech: true },
  {
    model_id: "eleven_multilingual_v2",
    name: "Eleven Multilingual v2",
    can_do_text_to_speech: true,
  },
  { model_id: "eleven_flash_v2_5", name: "Eleven Flash v2.5", can_do_text_to_speech: true },
];

const HELP = `ElevenLabs voice tool (model ${DEFAULT_MODEL}).

  node tools/voice.mjs check
      Check the API key and show subscription/voice counts.

  node tools/voice.mjs cost "text" [--model ${DEFAULT_MODEL}] [--json]
      Estimate the cost and show the rolling 7-day budget before generating.

  node tools/voice.mjs budget [--json]
      Show spend, cap and approvals for the last 7 days.

  node tools/voice.mjs voices [--search text] [--json]
      List voices in the account (id, name, category, labels).

  node tools/voice.mjs models [--json]
      List models that support text to speech.

  node tools/voice.mjs library [--search text] [--language ru] [--gender female]
      [--age young] [--accent american] [--category professional] [--limit 20] [--json]
      Search the shared voice library. Library voices must be added to the
      account before text to speech can use them.

  node tools/voice.mjs add <public_owner_id> <voice_id> [--name "New name"] --yes
      Add a shared voice to the account (uses a voice slot).

  node tools/voice.mjs say "text" [--voice ID] [--model ${DEFAULT_MODEL}]
      [--format ${DEFAULT_FORMAT}] [--out work/voice/line.mp3]
      [--stability 0.5] [--similarity 0.75] [--style 0] [--speed 1]
      [--lang ru] [--seed 1] [--previous TEXT] [--next TEXT]
      [--dry-run] [--approve-budget N]
      Generate speech and save it as audio. Without --voice it uses
      ELEVENLABS_VOICE_ID, otherwise the first voice in the account.

      The weekly budget is $${WEEKLY_BUDGET_USD} per rolling 7 days. If this
      request would push the total over the cap, say stops with exit code 2
      and asks for N x $1 approval blocks. Re-run with --approve-budget N
      only after the user explicitly agrees.

  node tools/voice.mjs --help
`;

async function loadEnv() {
  try {
    const raw = await readFile(join(ROOT, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

function requireKey() {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is empty: fill it in .env (see .env.example)");
  }
  return key;
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[name] = true;
    } else {
      flags[name] = next;
      i++;
    }
  }
  return { flags, positional };
}

async function api(pathname, { method = "GET", query, body } = {}) {
  const url = new URL(API + pathname);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(name, String(value));
  }
  const res = await fetch(url, {
    method,
    headers: {
      "xi-api-key": requireKey(),
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs ${method} ${pathname} failed: ${res.status} ${res.statusText}` +
        (detail ? `\n${detail.slice(0, 1500)}` : ""),
    );
  }
  return res;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function isJson(flags) {
  return flags.json === true || flags.json === "true";
}

function numberFlag(flags, name) {
  if (flags[name] === undefined) return undefined;
  const value = Number(flags[name]);
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a number`);
  return value;
}

function money(value) {
  if (!Number.isFinite(value)) return "$?";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs === 0) return "$0.00";
  if (abs < 0.01) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${abs.toFixed(2)}`;
}

function maxTextFor(model) {
  return MAX_TEXT_BY_MODEL[model] ?? MAX_TEXT;
}

function parseBlocks(value) {
  if (value === true || value === false) {
    throw new Error("--approve-budget needs a number of $1 blocks, e.g. --approve-budget 1");
  }
  const blocks = Number(value);
  if (!Number.isInteger(blocks) || blocks < 1) {
    throw new Error("--approve-budget must be a positive integer number of $1 blocks");
  }
  return blocks;
}

async function loadLedger() {
  try {
    return normalizeLedger(JSON.parse(await readFile(LEDGER_PATH, "utf8")));
  } catch (err) {
    if (err.code === "ENOENT") return emptyLedger();
    throw new Error(`cannot read spend ledger ${LEDGER_PATH}: ${err.message}`);
  }
}

async function saveLedger(ledger) {
  await mkdir(dirname(LEDGER_PATH), { recursive: true });
  await writeFile(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
}

function printBudget(budget) {
  console.log(
    `cost: ${money(budget.estimateUsd)} (${budget.characters} chars @ $${budget.ratePer1k.toFixed(2)}/1K, ${budget.model})`,
  );
  console.log(
    `week: ${money(budget.spentUsd)} spent of ${money(budget.capUsd)} cap; this request -> ${money(budget.projectedUsd)}`,
  );
  if (budget.approvalRequired) {
    console.log(
      `approval: need ${budget.blocksNeeded} x $1 block(s), ${money(budget.overByUsd)} over the cap`,
    );
  }
}

function labelText(voice) {
  const labels = voice.labels ?? {};
  return [labels.language, labels.accent, labels.gender, labels.age, labels.description, labels.use_case]
    .filter(Boolean)
    .join(", ");
}

async function fetchVoices() {
  const res = await api("/voices");
  const data = await res.json();
  return data.voices ?? [];
}

async function fetchVoiceName(voiceId) {
  try {
    const data = await (await api(`/voices/${encodeURIComponent(voiceId)}`)).json();
    return data.name ?? null;
  } catch {
    return null;
  }
}

async function commandCheck(flags) {
  const voices = await fetchVoices();
  let subscription = null;
  let subscriptionError = null;
  try {
    subscription = await (await api("/user/subscription")).json();
  } catch (err) {
    subscriptionError = err.message;
  }
  const payload = {
    key: "present",
    voices: voices.length,
    subscription: subscription
      ? {
          tier: subscription.tier,
          character_count: subscription.character_count,
          character_limit: subscription.character_limit,
          characters_remaining:
            subscription.character_limit != null && subscription.character_count != null
              ? subscription.character_limit - subscription.character_count
              : null,
          voice_limit: subscription.voice_limit,
          next_character_count_reset_unix: subscription.next_character_count_reset_unix,
        }
      : null,
    subscription_error: subscriptionError,
  };
  if (isJson(flags)) {
    printJson(payload);
    return;
  }
  console.log(`key: present`);
  console.log(`voices: ${payload.voices}`);
  if (subscription) {
    console.log(`tier: ${subscription.tier}`);
    console.log(
      `characters: ${subscription.character_count ?? "?"}/${subscription.character_limit ?? "?"}` +
        (payload.subscription.characters_remaining != null
          ? ` (${payload.subscription.characters_remaining} remaining)`
          : ""),
    );
    console.log(`voice slots: ${subscription.voice_limit ?? "?"}`);
  } else {
    console.log(`subscription: unavailable (${subscriptionError.split("\n")[0]})`);
  }
}

async function commandVoices(flags) {
  let voices = await fetchVoices();
  const search = String(flags.search ?? "").trim().toLowerCase();
  if (search) {
    voices = voices.filter((voice) =>
      [voice.voice_id, voice.name, voice.category, labelText(voice), voice.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }
  if (isJson(flags)) {
    printJson({ count: voices.length, voices });
    return;
  }
  if (voices.length === 0) {
    console.log("no voices matched");
    return;
  }
  console.log(`${voices.length} voice(s):`);
  for (const voice of voices) {
    console.log(
      `- ${voice.name ?? "?"} [${voice.category ?? "?"}] ${voice.voice_id ?? "?"}` +
        (labelText(voice) ? ` — ${labelText(voice)}` : ""),
    );
  }
}

async function commandModels(flags) {
  let models;
  let note = null;
  try {
    const data = await (await api("/models")).json();
    models = (Array.isArray(data) ? data : data.models ?? []).filter(
      (model) => model.can_do_text_to_speech !== false,
    );
  } catch (err) {
    if (!/missing_permissions|401/.test(err.message)) throw err;
    models = DOCUMENTED_MODELS;
    note = "the API key has no models_read permission; showing documented models";
  }
  if (isJson(flags)) {
    printJson({ count: models.length, models, note });
    return;
  }
  console.log(`${models.length} text-to-speech model(s):`);
  for (const model of models) {
    const marker = model.model_id === DEFAULT_MODEL ? "  <- default" : "";
    const meta = model.languages
      ? ` (${model.languages.length} languages, ${model.max_characters_request ?? "?"} chars)`
      : "";
    console.log(`- ${model.model_id} — ${model.name ?? "?"}${meta}${marker}`);
  }
  if (note) console.log(`note: ${note}`);
}

async function commandLibrary(flags) {
  const query = {
    page_size: flags.limit ?? 20,
    search: flags.search,
    language: flags.language,
    gender: flags.gender,
    age: flags.age,
    accent: flags.accent,
    category: flags.category,
    sort: flags.sort,
  };
  const data = await (await api("/shared-voices", { query })).json();
  const voices = data.voices ?? [];
  if (isJson(flags)) {
    printJson({ count: voices.length, has_more: data.has_more ?? false, voices });
    return;
  }
  if (voices.length === 0) {
    console.log("no shared voices matched");
    return;
  }
  console.log(`${voices.length} shared voice(s)${data.has_more ? " (more available)" : ""}:`);
  for (const voice of voices) {
    const labels = [voice.accent, voice.gender, voice.age, voice.language, voice.use_case]
      .filter(Boolean)
      .join(", ");
    console.log(`- ${voice.name ?? "?"} ${voice.voice_id ?? "?"}`);
    console.log(`  owner: ${voice.public_owner_id ?? "?"}${labels ? ` | ${labels}` : ""}`);
    if (voice.preview_url) console.log(`  preview: ${voice.preview_url}`);
  }
  console.log(
    '\nAdd a voice before using it: node tools/voice.mjs add <public_owner_id> <voice_id> --name "..." --yes',
  );
}

async function commandAdd(positional, flags) {
  const [publicOwnerId, voiceId] = positional;
  if (!publicOwnerId || !voiceId) {
    throw new Error("usage: node tools/voice.mjs add <public_owner_id> <voice_id> --name \"...\" --yes");
  }
  if (flags.yes !== true) {
    throw new Error("adding a voice uses an account voice slot; repeat with --yes");
  }
  const body = { new_name: String(flags.name ?? `library-${voiceId.slice(0, 8)}`) };
  const data = await (
    await api(`/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      body,
    })
  ).json();
  if (isJson(flags)) {
    printJson(data);
    return;
  }
  console.log(`added voice: ${data.voice_id ?? "?"} (${body.new_name})`);
}

async function commandCost(positional, flags) {
  const text = String(flags.text ?? positional.join(" ")).trim();
  if (!text) throw new Error("nothing to estimate: pass text as an argument or --text");
  const model = String(flags.model ?? process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL);
  const characters = countCharacters(text);
  const budget = computeBudget({ ledger: await loadLedger(), model, characters });
  if (isJson(flags)) {
    printJson(budget);
    return;
  }
  printBudget(budget);
}

async function commandBudget(flags) {
  const ledger = await loadLedger();
  const status = weekStatus(ledger);
  const inWindow = (item) => {
    const at = Date.parse(item?.at);
    return Number.isFinite(at) && at >= status.sinceMs;
  };
  const entries = ledger.entries.filter(inWindow).slice(-10);
  const approvals = ledger.approvals.filter(inWindow);
  const payload = { ...status, entries, approvals };
  if (isJson(flags)) {
    printJson(payload);
    return;
  }
  console.log(
    `week: ${money(status.spentUsd)} spent of ${money(status.capUsd)} cap; ${money(status.remainingUsd)} remaining`,
  );
  console.log(`window: rolling ${status.windowDays} days since ${status.since}`);
  if (approvals.length === 0) {
    console.log("approvals: none");
  } else {
    for (const approval of approvals) {
      console.log(`approval: ${approval.blocks ?? 1} x $1 at ${approval.at}`);
    }
  }
  if (entries.length > 0) {
    console.log("recent spend:");
    for (const entry of entries) {
      const file = entry.file ? ` ${entry.file}` : "";
      console.log(
        `- ${entry.at} ${entry.model ?? "?"} ${entry.characters ?? "?"} chars ` +
          `${money(Number(entry.usd) || 0)}${file}`,
      );
    }
  }
  console.log(`ledger: ${LEDGER_PATH}`);
}

async function commandSay(positional, flags) {
  const text = String(flags.text ?? positional.join(" ")).trim();
  if (!text) {
    throw new Error("nothing to say: pass text as an argument or --text");
  }
  const model = String(flags.model ?? process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL);
  const characters = countCharacters(text);
  const maxText = maxTextFor(model);
  if (characters > maxText) {
    throw new Error(`text is ${characters} chars, the ${model} limit is ${maxText}`);
  }

  const ledger = await loadLedger();
  let budget = computeBudget({ ledger, model, characters });

  const approval = flags["approve-budget"];
  if (approval !== undefined) {
    const blocks = parseBlocks(approval);
    if (!budget.approvalRequired) {
      console.warn("budget: no approval needed, --approve-budget ignored");
    } else if (blocks < budget.blocksNeeded) {
      throw new Error(
        `budget: need ${budget.blocksNeeded} x $1 approval block(s), got ${blocks}`,
      );
    } else if (flags["dry-run"] !== true) {
      ledger.approvals.push({
        at: new Date().toISOString(),
        blocks,
        usd: round6(blocks * WEEKLY_BUDGET_USD),
        note: "user approved",
      });
      await saveLedger(ledger);
      budget = computeBudget({ ledger, model, characters });
    }
  }

  if (budget.approvalRequired) {
    if (isJson(flags)) {
      printJson({
        ...budget,
        dry_run: flags["dry-run"] === true,
        message: `approval required: ${budget.blocksNeeded} x $1 block(s)`,
      });
    } else {
      printBudget(budget);
      console.error(
        `approval required: ask the user for ${budget.blocksNeeded} x $1 block(s), ` +
          `then re-run with --approve-budget ${budget.blocksNeeded}`,
      );
    }
    process.exitCode = 2;
    return;
  }

  if (flags["dry-run"] === true) {
    if (isJson(flags)) {
      printJson({ ...budget, dry_run: true });
    } else {
      printBudget(budget);
      console.log("dry run: no audio generated");
    }
    return;
  }

  let voiceId = String(flags.voice ?? process.env.ELEVENLABS_VOICE_ID ?? "").trim();
  let voiceName = null;
  if (!voiceId) {
    const voices = await fetchVoices();
    if (voices.length === 0) {
      throw new Error("the account has no voices: add one or pass --voice");
    }
    voiceId = voices[0].voice_id;
    voiceName = voices[0].name;
  } else {
    voiceName = await fetchVoiceName(voiceId);
  }

  if (!isJson(flags)) printBudget(budget);

  const format = String(flags.format ?? DEFAULT_FORMAT);
  const voiceSettings = {};
  for (const [flag, field] of [
    ["stability", "stability"],
    ["similarity", "similarity_boost"],
    ["style", "style"],
    ["speed", "speed"],
  ]) {
    const value = numberFlag(flags, flag);
    if (value !== undefined) voiceSettings[field] = value;
  }
  if (flags["no-speaker-boost"] === true) voiceSettings.use_speaker_boost = false;

  const body = { text, model_id: model };
  if (Object.keys(voiceSettings).length > 0) body.voice_settings = voiceSettings;
  if (flags.lang) body.language_code = String(flags.lang);
  if (flags.seed !== undefined) body.seed = numberFlag(flags, "seed");
  if (flags.previous) body.previous_text = String(flags.previous).slice(0, 1000);
  if (flags.next) body.next_text = String(flags.next).slice(0, 1000);

  const res = await api(`/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    query: { output_format: format },
    body,
  });
  const audio = Buffer.from(await res.arrayBuffer());
  if (audio.length === 0) throw new Error("ElevenLabs returned empty audio");

  const out = flags.out
    ? resolve(process.cwd(), String(flags.out))
    : join(DEFAULT_OUT_DIR, `${flags.name ?? `line-${Date.now()}`}.mp3`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, audio);

  ledger.entries.push({
    at: new Date().toISOString(),
    model,
    characters,
    usd: budget.estimateUsd,
    voice_id: voiceId,
    file: out,
  });
  await saveLedger(ledger);

  const result = {
    file: out,
    bytes: audio.length,
    voice_id: voiceId,
    voice_name: voiceName,
    model,
    format,
    characters,
    cost_usd: budget.estimateUsd,
    week_spent_usd: round6(budget.spentUsd + budget.estimateUsd),
    week_cap_usd: budget.capUsd,
    request_id: res.headers.get("request-id") ?? res.headers.get("x-request-id") ?? undefined,
  };
  if (isJson(flags)) {
    printJson(result);
    return;
  }
  console.log(`saved: ${out}`);
  console.log(`voice: ${voiceName ?? "?"} (${voiceId})`);
  console.log(`model: ${model}, format: ${format}`);
  console.log(`audio: ${(audio.length / 1024).toFixed(1)} KiB, text: ${characters} chars`);
}

async function main() {
  await loadEnv();
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const command = positional.shift() ?? (flags.help ? "help" : "");

  if (!command || command === "help" || flags.help) {
    process.stdout.write(HELP);
    return;
  }
  switch (command) {
    case "check":
      return commandCheck(flags);
    case "cost":
      return commandCost(positional, flags);
    case "budget":
      return commandBudget(flags);
    case "voices":
      return commandVoices(flags);
    case "models":
      return commandModels(flags);
    case "library":
      return commandLibrary(flags);
    case "add":
      return commandAdd(positional, flags);
    case "say":
      return commandSay(positional, flags);
    default:
      throw new Error(`unknown command "${command}" (try --help)`);
  }
}

await main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
