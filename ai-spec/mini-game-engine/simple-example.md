# Overview
The initial state represented in the ./puzzle.png image can be represented as:
```json
{
  "activePlayer": 1,
  "gamePhase": 0,
  "nextPlayId": 13,
  "player1": {
    "base": {
      "cardId": "SOR_022", //ECL
      "epicActionUsed": false,
      "damage": 23
    },
    "leader": {
      "cardId": "SOR_014", //Sabine Wren - Galvanized Revolutionary
      "epicActionUsed": false,
      "ready": true,
      "deployed": false
    },
    "spaceArena": [],
    "groundArena": [
      {
        "cardId": "SOR_145", //K-2SO - Cassian's Counterpart
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
        "damage": 0,
        "upgrades": [],
        "captives": []
      },
      {
        "cardId": "SHD_160", //Reckless Gunslinger
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
        "damage": 0,
        "upgrades": [],
        "captives": []
      },
    ],
    "resources": [
      {
        "cardId": "SHD_160", //Reckless Gunslingers (doesn't matter in this puzzle)
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
      },
      {
        "cardId": "SHD_160",
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
      },
      {
        "cardId": "SHD_160",
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
      },
      {
        "cardId": "SHD_160",
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
      },
      {
        "cardId": "SHD_160",
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
      },
      {
        "cardId": "SHD_160",
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
      },
      {
        "cardId": "SHD_160",
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
      },
      {
        "cardId": "SHD_160",
        "playId": "@",
        "owner": 1,
        "controller": 1,
        "ready": true,
      },
    ],
    "discard": [],
    "deck": [],
    "hand": [
      { "cardId": "JTL_153" },
      { "cardId": "SOR_168" },
      { "cardId": "SOR_103" },
      { "cardId": "SOR_141" },
      { "cardId": "SOR_150" }
    ],
    "supplemental": {}
  },
  "player2": {
    "base": {
      "cardId": "SOR_025", //Tarkintown
      "epicActionUsed": false,
      "damage": 11
    },
    "leader": {
      "cardId": "SHD_014", //Cad Bane - He Who Needs No Introduction
      "epicActionUsed": true,
      "ready": true,
      "deployed": false
    },
    "spaceArena": [],
    "groundArena": [
      {
        "cardId": "SOR_211", //Gamorrean Guards
        "playId": "@",
        "owner": 2,
        "controller": 2,
        "ready": false,
        "damage": 0,
        "upgrades": [],
        "captives": []
      },
      {
        "cardId": "TWI_187", //Cad Bane - Hostage Taker
        "playId": "@",
        "owner": 2,
        "controller": 2,
        "ready": false,
        "damage": 0,
        "upgrades": [],
        "captives": []
      },
    ],
    "resources": [],
    "discard": [],
    "deck": [],
    "hand": [],
    "supplemental": {}
  },
  "currentEffects": [],
  "currentRound": 7,
  "initiativePlayer": 2,
  "initiativeClaimed": true,
  "triggerBag": []
}
```