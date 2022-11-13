import { dirname, importx } from "@discordx/importer";
import { GatewayIntentBits } from "discord.js";
import { Client } from "discordx";
import { data, read } from "./arc.sub.js";

export const Bot = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function start() {
  await importx(dirname(import.meta.url) + `/arc.sub.{ts,js}`);

  const ok = await read();

  if (!process.env.TOKEN) {
    throw Error("system env の TOKEN にボットトークンをセットしてください。")
  }

  await Bot.login(process.env.TOKEN, true);
}

start();
