import { PendingResolution } from "@/server/engine/pending-resolution";

export function resolveWhenDeployed(
  cardId: string,
  //playId: string,
  //player: PlayerId
): PendingResolution | null {
  switch (cardId) {
    default:
      return null;
  }
}