import { GameState } from "@/lib/engine/game";
import { describe, it, expect } from "vitest";
import { sabineWrenCadBaneSimplePuzzleState } from "../unit/engine/_gamestates/simple";

describe("Integration: HttpTransport", () => {
  it("responds to a simple request", async () => {
    // arrange
    const baseUri = "http://localhost:3000/api/engine";
    const response = await fetch(`${baseUri}/new-game`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        withGameState: sabineWrenCadBaneSimplePuzzleState,
      }),
    });

    expect(response.ok).toBe(true);

    const { gameId } = await response.json() as { gameId: string };
    expect(gameId).toBeDefined();

    const message = {
      gameId,
      dispatch: {
        type: "useLeaderAbility",
        playerId: 1,
      },
    };

    const dispatchResponse = await fetch(`${baseUri}/dispatch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, context: null }),
    });

    expect(dispatchResponse.ok).toBe(true);

    // act
    const { response: { newGameState } } = await dispatchResponse.json() as {
      response: {
        newGameState: GameState;
      };
    };

    // assert
    expect(newGameState.player1.base.damage).toBe(24);
    expect(newGameState.player2.base.damage).toBe(12);
  });
});

