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

  await Bot.login(data["token"], true);
}

start();
