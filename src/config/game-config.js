// 게임 전역 상수와 초기 밸런스를 관리한다.
(function attachGameConfig(global) {
  global.DungeonConfig = {
    player: {
      classLabel: "전사",
      speed: 198,
      attackRange: 78,
      baseAttackRateStage: 1,
      attackCooldownBase: 900,
      baseDamage: 10,
      strength: 5,
      dexterity: 2,
      knowledge: 1,
      defense: 7,
      maxHp: 180,
      maxMp: 80,
    },
    room: {
      number: 1,
      label: "Forgotten Hall",
      minMonsterLevel: 1,
    },
    world: {
      width: 2400,
      height: 2400,
    },
    monsters: {
      maxAlive: 18,
      spawnInterval: 950,
      spawnRadiusMin: 320,
      spawnRadiusMax: 560,
      speedMin: 42,
      speedMax: 68,
      projectileSpeed: 1040,
      attackIntervalMin: 1200,
      attackIntervalMax: 1800,
      attackRangeMin: 180,
      attackRangeMax: 340,
      projectileDamage: 10,
    },
    progression: {
      baseXpToNext: 20,
      xpRewardBase: 12,
    },
  };
})(window);
