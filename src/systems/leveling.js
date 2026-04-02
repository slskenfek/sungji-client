// 경험치, 필요 경험치, 레벨업 증가량 계산을 분리한다.
(function attachLeveling(global) {
  const config = global.DungeonConfig;

  function getXpToNext(level) {
    return config.progression.baseXpToNext * level * level;
  }

  function getMonsterLevel(playerLevel, roomMinLevel) {
    const highestLevel = Math.max(roomMinLevel, playerLevel);
    return Phaser.Math.Between(roomMinLevel, highestLevel);
  }

  function getMonsterXpReward(level) {
    return Math.round(config.progression.xpRewardBase * Math.pow(1.2, Math.max(0, level - 1)));
  }

  function getMonsterDefenseMultiplier(level) {
    return 1 + Math.max(0, level - 1) * 0.5;
  }

  global.DungeonLeveling = {
    getXpToNext,
    getMonsterLevel,
    getMonsterXpReward,
    getMonsterDefenseMultiplier,
  };
})(window);
