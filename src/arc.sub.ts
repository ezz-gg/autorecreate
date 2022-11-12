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
  PermissionsBitField,
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
  if (isAdmin) if (data.admin[id]) return true;
  if (!isAdmin) if (data.blacklist[id]) return true;

  return false;
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

    Bot.user?.setActivity({
      name: "Servers: " + Bot.guilds.cache.size,
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
export class Other {
  @Slash({
    name: "ping",
    description: "通信の遅延を表示します。",
  })
  async ping(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle("Pong!")
      .addFields({ name: "Websocket Latency", value: Bot.ws.ping + "ms" })
      .addFields({
        name: "API Latency",
        value: Date.now() - interaction.createdTimestamp + "ms",
      });

    await interaction.editReply({
      embeds: [embed],
    });
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

  let min = String(dateta.getMinutes());
  let hour = String(dateta.getHours());

  if (min.length === 1) min = "0" + min;
  if (hour.length === 1) hour = "0" + hour;

  let text = hour + ":" + min;

  return text;
}

async function arcBlack(Guilds: Collection<string, OAuth2Guild>) {
  Guilds.map(async (g1) => {
    try {
      const guild = await g1.fetch();

      if (check(guild.id, false)) await guild.leave();
    } catch {}
  });
}

async function arcCheck(Guilds: Collection<string, OAuth2Guild>, time: string) {
  let g: Guild[] = [];
  for (const gu of Guilds) g.push(await gu[1].fetch());

  let chIds: string[] = [];

  for (const cha of g) {
    if (
      cha.members.me?.permissions.has(
        PermissionsBitField.Flags.ManageChannels,
        false
      )
    ) {
      const c = await cha.channels.fetch();

      for (const cha2 of c)
        if (cha2[1])
          if (cha2[1].type === ChannelType.GuildText) {
            const ch = cha2[1] as TextChannel;

            if (ch.topic) {
              const result = ch.topic.match(/autorecreate\[(?<time>.*?)\]/);

              if (result)
                if (result.groups?.time) {
                  const splited: string[] = result.groups.time.split(",");

                  for (const str of splited) {
                    const itibu = str
                      .replace(/\s/g, "")
                      .match(/[0-2][0-9]:[0-5][0-9]/);

                    if (itibu)
                      if (itibu.length) {
                        if (itibu[0] === time) {
                          chIds.push(ch.id);
                          break;
                        }
                      }
                  }
                }
            }
          }
    }
  }

  return chIds;
}

async function arcRun(channels: string[], time: string) {
  for (const chid of channels) {
    const ch = (await Bot.channels.fetch(chid, {
      force: true,
    })) as TextChannel | null;

    if (ch) {
      try {
        const newCh = await ch?.clone({
          reason: "Auto Recreate",
          position: ch.position,
          nsfw: ch.nsfw,
          rateLimitPerUser: ch.rateLimitPerUser,
        });

        await ch?.delete("Auto Recreate");

        if (ch.defaultAutoArchiveDuration)
          await newCh.setDefaultAutoArchiveDuration(
            ch.defaultAutoArchiveDuration,
            "Auto Recreate"
          );

        const embed = new EmbedBuilder()
          .setFooter({
            text: ch.guild.name,
            iconURL: ch.guild.iconURL() || undefined,
          })
          .addFields({
            name: `現在時刻 ${time} をお知らせします！`,
            value: "チャンネルの再作成が完了しました！",
          });

        await newCh.send({
          embeds: [embed],
        });
      } catch {}
    }
  }
}

cron.schedule("0,5,10,15,20,25,30,35,40,45,50,55 * * * *", async (date) => {
  const fixedDate = arcFixDate(date);

  console.log("処理開始：" + fixedDate);

  const guilds1 = await Bot.guilds.fetch();

  await arcBlack(guilds1);

  const guilds2 = await Bot.guilds.fetch();

  const channels = await arcCheck(guilds2, fixedDate);

  console.log("再作成対象のチャンネル数：" + channels.length);
  console.log(channels);

  await arcRun(channels, fixedDate);

  data.total += channels.length;

  await save();
});
