import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "./card-helpers";
import type { GameTestAdapter } from "./unit/game-test-adapter";

/** The eligible target playIds of the pending Target prompt, or [] when the prompt isn't one. */
export function TargetIds(g: GameTestAdapter): string[] {
  const resolution = g.lastDispatchResponse?.resolutionNeeded;
  return resolution?.type === "Target" ? resolution.fromPlayIds ?? [] : [];
}

/** The helper text of the pending Option prompt, or "" when the prompt isn't one. */
export function OptionText(g: GameTestAdapter): string {
  const resolution = g.lastDispatchResponse?.resolutionNeeded;
  return resolution?.type === "Option" ? resolution.helperText ?? "" : "";
}

type ColorCodes =
  | "bbk" //blue blue black
  | "bgk" //blue green black
  | "brk" //blue red black
  | "byk" //blue yellow black
  | "bbw" //blue blue white
  | "bgw" //blue green white
  | "brw" //blue red white
  | "byw" //blue yellow white
  | "gbk" //green blue black
  | "ggk" //green green black
  | "grk" //green red black
  | "gyk" //green yellow black
  | "gbw" //green blue white
  | "ggw" //green green white
  | "grw" //green red white
  | "gyw" //green yellow white
  | "rbk" //red blue black
  | "rgk" //red green black
  | "rrk" //red red black
  | "ryk" //red yellow black
  | "rbw" //red blue white
  | "rgw" //red green white
  | "rrw" //red red white
  | "ryw" //red yellow white
  | "ybk" //yellow blue black
  | "ygk" //yellow green black
  | "yrk" //yellow red black
  | "yyk" //yellow yellow black
  | "ybw" //yellow blue white
  | "ygw" //yellow green white
  | "yrw" //yellow red white
  | "yyw" //yellow yellow white
  | "nbk" //neutral blue black
  | "ngk" //neutral green black
  | "nrk" //neutral red black
  | "nyk" //neutral yellow black
  | "nbw" //neutral blue white
  | "ngw" //neutral green white
  | "nrw" //neutral red white
  | "nyw" //neutral yellow white
;

type CommonSetupOptions = {
  my: PlayerOptions,
  their: PlayerOptions,
}

type PlayerOptions = {
  baseDamage?: number,
  baseEpicActionUsed?: boolean,
  baseNumUses?: number,
  leaderReady?: boolean,
  leaderDeployed?: boolean,
  leaderEpicActionUsed?: boolean,
  resourceCount?: number,
  handCardIds?: string[],
}

export function CommonSetup(gsb: GameStateBuilder,
  myLeaderBaseColors: ColorCodes,
  theirLeaderBaseColors: ColorCodes,
  opts: CommonSetupOptions = {
    my: {},
    their: {},
  }
): GameStateBuilder {
  const baseCardIds: Record<string, string> = {
    b: Cards.bases.common.blue30HP,
    g: Cards.bases.common.green30HP,
    r: Cards.bases.common.red30HP,
    y: Cards.bases.common.yellow30HP,
    n: Cards.bases.jtl.lakeCountry,
  }

  const leaderCardIds: Record<string, string> = {
    bk: Cards.leaders.sor.idenVersio,
    gk: Cards.leaders.sor.grandMoffTarkin,
    rk: Cards.leaders.sor.darthVader,
    yk: Cards.leaders.sor.grandAdmiralThrawn,
    bw: Cards.leaders.sor.lukeSkywalker,
    gw: Cards.leaders.sor.leiaOrgana,
    rw: Cards.leaders.sor.sabineWren,
    yw: Cards.leaders.sor.hanSolo,
  }

  const myBase = myLeaderBaseColors[0];
  const theirBase = theirLeaderBaseColors[0];
  if (!baseCardIds[myBase] || !baseCardIds[theirBase]) {
    throw new Error(`Invalid base color code. Received ${myBase} and ${theirBase}.`);
  }

  const myLeader = myLeaderBaseColors.slice(1);
  const theirLeader = theirLeaderBaseColors.slice(1);
  if (!leaderCardIds[myLeader] || !leaderCardIds[theirLeader]) {
    throw new Error(`Invalid leader color code. Received ${myLeader} and ${theirLeader}.`);
  }

  gsb
    .MyBase(baseCardIds[myBase], opts.my.baseDamage ?? 0, opts.my.baseEpicActionUsed ?? false, opts.my.baseNumUses ?? 0)
    .MyLeader(leaderCardIds[myLeader], opts.my.leaderReady ?? true, opts.my.leaderDeployed ?? false, opts.my.leaderEpicActionUsed ?? false)
    .TheirBase(baseCardIds[theirBase], opts.their.baseDamage ?? 0, opts.their.baseEpicActionUsed ?? false, opts.their.baseNumUses ?? 0)
    .TheirLeader(leaderCardIds[theirLeader], opts.their.leaderReady ?? true, opts.their.leaderDeployed ?? false, opts.their.leaderEpicActionUsed ?? false)
  ;

  const vanillaResource = Cards.units.sor.battlefieldMarine;

  if (opts.my.resourceCount) {
    gsb.FillResourcesForPlayer(1, vanillaResource, opts.my.resourceCount);
  }

  if (opts.their.resourceCount) {
    gsb.FillResourcesForPlayer(2, vanillaResource, opts.their.resourceCount);
  }

  if (opts.my.handCardIds) {
    for (const cardId of opts.my.handCardIds) {
      gsb.WithCardInHandForPlayer(1, cardId);
    }
  }

  if (opts.their.handCardIds) {
    for (const cardId of opts.their.handCardIds) {
      gsb.WithCardInHandForPlayer(2, cardId);
    }
  }

  return gsb;
}

