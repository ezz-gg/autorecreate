import {
  ArgsOf,
  Client,
  Discord,
  On,
  Once,
  Slash,
  SlashGroup,
  SlashOption,
} from "discordx";
import { dirname } from "@discordx/importer";
import { Bot } from "./arc.js";
import { readFile, writeFile } from "node:fs/promises";
import {
  ActivityType,
  ApplicationCommandOptionType,
  AttachmentBuilder,
  ChannelType,
  Collection,
  CommandInteraction,
  EmbedBuilder,
  Guild,
  OAuth2Guild,
  TextChannel,
} from "discord.js";
import * as cron from "node-cron";
import { setTimeout } from "node:timers/promises";

process.env.TZ = "Asia/Tokyo";

const file = dirname(import.meta.url) + "/arc.config.json";

type dt = {
  token: string;
  total: number;
  admin: Record<string, string>;
  blacklist: Record<string, string>;
};

export let data: dt;

export async function read() {
  const d = JSON.parse((await readFile(file)).toString());

  data = d;
}

function add(id: string, name: string, isAdmin: boolean) {
  if (isAdmin) data.admin[id] = name;
  if (!isAdmin) data.blacklist[id] = name;
}

function del(id: string, isAdmin: boolean) {
  if (isAdmin) delete data.admin[id];
  if (!isAdmin) delete data.blacklist[id];
}

function check(id: string, isAdmin: boolean) {
  try {
    if (isAdmin) data.admin[id];
    if (!isAdmin) data.blacklist[id];

    return true;
  } catch {
    return false;
  }
}

async function save() {
  await writeFile(file, JSON.stringify(data));
}

function DDHHMMSS(uptime: number, format: string) {
  let sec_num = parseInt(String(uptime), 10);
  let days: any = Math.floor(sec_num / 86400);
  let hours: any = Math.floor((sec_num - days * 86400) / 3600);
  let minutes: any = Math.floor((sec_num - (days * 86400 + hours * 3600)) / 60);
  let seconds: any = sec_num - (days * 86400 + hours * 3600) - minutes * 60;

  if (hours < 10) hours = "0" + hours;
  if (minutes < 10) minutes = "0" + minutes;
  if (seconds < 10) seconds = "0" + seconds;

  return format
    .replaceAll("%D", days)
    .replaceAll("%H", hours)
    .replaceAll("%M", minutes)
    .replaceAll("%S", seconds);
}

async function statusChanger() {
  while (true) {
    Bot.user?.setActivity({
      name: "AutoRecreate",
      type: ActivityType.Playing,
    });

    await setTimeout(1000 * 5);

    Bot.user?.setActivity({
      name: "Uptime: " + DDHHMMSS(process.uptime(), "%D日%H時間%M分%S秒"),
      type: ActivityType.Playing,
    });

    await setTimeout(1000 * 5);

    Bot.user?.setActivity({
      name: "Total Recreated: " + data.total,
      type: ActivityType.Playing,
    });

    await setTimeout(1000 * 5);
  }
}

@Discord()
export class Events {
  @On({ event: "interactionCreate" })
  async interactionCreate(
    [interaction]: ArgsOf<"interactionCreate">,
    client: Client,
    guardPayload: any
  ) {
    await Bot.executeInteraction(interaction);
  }

  @Once({ event: "ready" })
  async ready() {
    console.log(">> Bot started");

    await Bot.initApplicationCommands();

    await statusChanger();
  }
}

@Discord()
@SlashGroup({ name: "owner" })
@SlashGroup({ name: "blacklist", root: "owner" })
@SlashGroup({ name: "adminlist", root: "owner" })
export class Owner {
  @SlashGroup("blacklist", "owner")
  @Slash({
    name: "add",
    description: "ブラックリストにサーバーを追加します。",
    defaultMemberPermissions: "Administrator",
  })
  async blacklistAdd(
    @SlashOption({
      name: "serverid",
      description: "ブラックリストに追加するサーバーのID",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    ServerId: string,
    interaction: CommandInteraction
  ) {
    await interaction.deferReply({ ephemeral: true });

    let embed: EmbedBuilder = new EmbedBuilder().setFooter({
      text: "Auto Recreate",
      iconURL: Bot.user?.displayAvatarURL(),
    });

    if (check(interaction.user?.id, true)) {
      let bg: Guild | null = null;

      try {
        bg = (await Bot.guilds.fetch(ServerId)) || null;
      } catch {}

      if (bg) {
        const owner = await bg.fetchOwner({ force: true });

        embed = embed.addFields({
          name: "設定変更完了",
          value: `ブラックリストに ${bg.name} (ID:${bg.id}, Owner:(Name:${owner.user.tag}, ID:${owner.user.id})) を追加しました。`,
        });

        add(ServerId, bg.name, false);

        await bg.leave();
      } else {
        embed = embed.addFields({
          name: "設定変更完了",
          value: `ブラックリストに ${ServerId} を追加しました。`,
        });

        add(ServerId, "null", false);
      }

      await save();
    } else {
      embed = embed.addFields({
        name: "設定変更失敗",
        value: "あなたはこのBotの権利者ではありません。",
      });
    }

    await interaction.editReply({
      embeds: [embed],
    });
  }

  @SlashGroup("blacklist", "owner")
  @Slash({
    name: "del",
    description: "ブラックリストからサーバーを削除します。",
    defaultMemberPermissions: "Administrator",
  })
  async blacklistDel(
    @SlashOption({
      name: "serverid",
      description: "ブラックリストから削除するサーバーのID",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    ServerId: string,
    interaction: CommandInteraction
  ) {
    await interaction.deferReply({ ephemeral: true });

    let embed: EmbedBuilder = new EmbedBuilder().setFooter({
      text: "Auto Recreate",
      iconURL: Bot.user?.displayAvatarURL(),
    });

    if (check(interaction.user?.id, true)) {
      embed = embed.addFields({
        name: "設定変更完了",
        value: `ブラックリストから ${ServerId} を削除しました。`,
      });

      del(ServerId, false);

      await save();
    } else {
      embed = embed.addFields({
        name: "設定変更失敗",
        value: "あなたはこのBotの権利者ではありません。",
      });
    }

    await interaction.editReply({
      embeds: [embed],
    });
  }

  @SlashGroup("blacklist", "owner")
  @Slash({
    name: "list",
    description: "ブラックリストにあるサーバー一覧を表示します。",
    defaultMemberPermissions: "Administrator",
  })
  async blacklistList(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    let embed: EmbedBuilder = new EmbedBuilder().setFooter({
      text: "Auto Recreate",
      iconURL: Bot.user?.displayAvatarURL(),
    });

    if (check(interaction.user?.id, true)) {
      let blackGuilds = "";
      for (const bg of Object.keys(data.blacklist)) {
        blackGuilds += bg + "\n";
      }

      embed = embed.setTitle("ブラックリストにあるサーバー一覧");

      const blackGuildsTxt = new AttachmentBuilder(
        Buffer.from(blackGuilds, "utf8"),
        {
          name: "BlackGuilds.txt",
          description: "ブラックリストにあるサーバー一覧",
        }
      );

      await interaction.editReply({
        embeds: [embed],
        files: [blackGuildsTxt],
      });
    } else {
      embed = embed.addFields({
        name: "設定表示失敗",
        value: "あなたはこのBotの権利者ではありません",
      });

      await interaction.editReply({
        embeds: [embed],
      });
    }
  }

  @SlashGroup("adminlist", "owner")
  @Slash({
    name: "add",
    description: "アドミンリストにユーザーを追加します。",
    defaultMemberPermissions: "Administrator",
  })
  async adminlistAdd(
    @SlashOption({
      name: "serverid",
      description: "アドミンリストに追加するサーバーのID",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    UserId: string,
    interaction: CommandInteraction
  ) {
    await interaction.deferReply({ ephemeral: true });

    let embed: EmbedBuilder = new EmbedBuilder().setFooter({
      text: "Auto Recreate",
      iconURL: Bot.user?.displayAvatarURL(),
    });

    if (check(interaction.user?.id, true)) {
      embed = embed.addFields({
        name: "設定変更完了",
        value: `アドミンリストに ${UserId} を追加しました。`,
      });

      add(UserId, "null", true);

      await save();
    } else {
      embed = embed.addFields({
        name: "設定変更失敗",
        value: "あなたはこのBotの権利者ではありません。",
      });
    }

    await interaction.editReply({
      embeds: [embed],
    });
  }

  @SlashGroup("adminlist", "owner")
  @Slash({
    name: "del",
    description: "アドミンリストからユーザーを削除します。",
    defaultMemberPermissions: "Administrator",
  })
  async adminlistDel(
    @SlashOption({
      name: "userid",
      description: "アドミンリストから削除するユーザーのID",
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    UserId: string,
    interaction: CommandInteraction
  ) {
    await interaction.deferReply({ ephemeral: true });

    let embed: EmbedBuilder = new EmbedBuilder().setFooter({
      text: "Auto Recreate",
      iconURL: Bot.user?.displayAvatarURL(),
    });

    if (check(interaction.user?.id, true)) {
      embed = embed.addFields({
        name: "設定変更完了",
        value: `アドミンリストから ${UserId} を削除しました。`,
      });

      del(UserId, true);

      await save();
    } else {
      embed = embed.addFields({
        name: "設定変更失敗",
        value: "あなたはこのBotの権利者ではありません。",
      });
    }

    await interaction.editReply({
      embeds: [embed],
    });
  }

  @SlashGroup("adminlist", "owner")
  @Slash({
    name: "list",
    description: "アドミンリストにあるサーバー一覧を表示します。",
    defaultMemberPermissions: "Administrator",
  })
  async adminlistList(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    let embed: EmbedBuilder = new EmbedBuilder().setFooter({
      text: "Auto Recreate",
      iconURL: Bot.user?.displayAvatarURL(),
    });

    if (check(interaction.user?.id, true)) {
      let adminUsers = "";
      for (const bg of Object.keys(data.admin)) {
        adminUsers += bg + "\n";
      }

      embed = embed.setTitle("アドミンリストにあるサーバー一覧");

      const blackGuildsTxt = new AttachmentBuilder(
        Buffer.from(adminUsers, "utf8"),
        {
          name: "AdminlistUsers.txt",
          description: "アドミンリストにユーザー一覧",
        }
      );

      await interaction.editReply({
        embeds: [embed],
        files: [blackGuildsTxt],
      });
    } else {
      embed = embed.addFields({
        name: "設定表示失敗",
        value: "あなたはこのBotの権利者ではありません",
      });

      await interaction.editReply({
        embeds: [embed],
      });
    }
  }
}

function arcFixDate(date: Date | "manual") {
  const dateta = date as Date;

  const min = dateta.getMinutes();
  const hour = dateta.getHours();

  let text = hour + ":";

  switch (true) {
    case 0 <= min && 15 > min:
      text += "00";
      break;
    case 15 <= min && 30 > min:
      text += "15";
      break;
    case 30 <= min && 45 > min:
      text += "30";
      break;
    case 45 <= min && 60 > min:
      text += "45";
      break;
    default:
      text += "00";
      break;
  }

  if (text.length === 4) text = "0" + text;

  return text;
}

async function arcCheck(Guilds: Collection<string, OAuth2Guild>, time: string) {
  let g: Guild[] = [];
  for (const gu of Guilds) g.push(await gu[1].fetch());

  const ch: TextChannel[] = [];
  for (const cha of g) {
    const c = await cha.channels.fetch();
    for (const cha2 of c)
      if (cha2[1].type === ChannelType.GuildText) ch.push(cha2[1]);
  }

  let channelKansei: string[] = [];

  for (const c of ch) {
    if (c.topic) {
      const result = c.topic.match(/autorecreate\[(?<time>.*?)\]/);

      if (result)
        if (result.groups?.time) {
          const splited = result.groups.time.split(",");

          let kansei: string[] = [];

          for (const str of splited) {
            const vali = Array.from(
              new Set(str.trim().match(/[0-2][0-9]:[0-5][0-9]/))
            );
            if (vali) kansei.push(vali[0]);
          }

          for (const jikan of kansei) {
            if (jikan === time) channelKansei.push(c.id);
          }
        }
    }
  }

  return channelKansei;
}

async function arcRun(channels: string[], time: string) {
  for (const chid of channels) {
    const ch = (await Bot.channels.fetch(chid, {
      force: true,
    })) as TextChannel | null;

    if (ch) {
      let failCounter = 0;

      let newCh: TextChannel | null = null;

      while (true) {
        try {
          newCh = await ch?.clone();

          break;
        } catch {
          if (failCounter > 5) {
            break;
          }
          failCounter += 1;
          await setTimeout(250);
        }
      }

      if (failCounter > 5) break;

      failCounter = 0;

      while (true) {
        try {
          await ch?.delete("Auto Recreate");

          break;
        } catch {
          if (failCounter > 5) {
            break;
          }
          failCounter += 1;
          await setTimeout(250);
        }
      }

      failCounter = 0;

      while (true) {
        try {
          await newCh?.setPosition(ch.position, { reason: "Auto Recreate" });

          break;
        } catch {
          if (failCounter > 5) {
            break;
          }
          failCounter += 1;
          await setTimeout(250);
        }
      }

      failCounter = 0;

      const embed = new EmbedBuilder()
        .setFooter({
          text: ch.guild.name,
          iconURL: ch.guild.iconURL() || undefined,
        })
        .addFields({
          name: `現在時刻 ${time} をお知らせします！`,
          value: "チャンネルの再作成が完了しました！",
        });

      while (true) {
        try {
          await newCh?.send({
            embeds: [embed],
          });

          break;
        } catch {
          if (failCounter > 5) {
            break;
          }
          failCounter += 1;
          await setTimeout(250);
        }
      }
    }
  }
}

console.log(new Date().getMinutes());

cron.schedule(
  "0,15,30,45 * * * *",
  async (date) => {
    const fixedDate = arcFixDate(date);

    console.log(fixedDate);

    const channels = await arcCheck(await Bot.guilds.fetch(), fixedDate);

    await arcRun(channels, fixedDate);

    data.total += channels.length;

    await save();
  },
  {
    name: "worker",
    timezone: "Asia/Tokyo",
  }
);