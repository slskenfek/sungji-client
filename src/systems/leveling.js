// 경험치, 필요 경험치, 레벨업 증가량 계산을 분리한다.
// Scene에서 숫자 공식을 분리한 "레벨링 규칙 모듈"이다.
(function attachLeveling(global) {
  const config = global.DungeonConfig;

  function getXpToNext(level) {
    // 레벨이 올라갈수록 필요 경험치가 빠르게 증가하도록 level^2 공식을 사용한다.
    return config.progression.baseXpToNext * level * level;
  }

  function getMonsterLevel(playerLevel, roomMinLevel) {
    // 일반 몬스터는 현재 플레이어 레벨과 비슷하게 생성하되 최대 2레벨 위까지만 허용한다.
    const normalizedPlayerLevel = Math.max(roomMinLevel, Math.max(1, playerLevel));
    const highestLevel = Math.max(normalizedPlayerLevel, playerLevel + 2);
    return Phaser.Math.Between(normalizedPlayerLevel, highestLevel);
  }

  function getMonsterXpReward(level) {
    // 몬스터 레벨이 오를수록 경험치 보상이 증가한다.
    return Math.round(config.progression.xpRewardBase * Math.pow(1.2, Math.max(0, level - 1)));
  }

  function getMonsterDefenseMultiplier(level) {
    // 상위 레벨 몬스터가 더 단단하게 느껴지도록 방어 배율을 더한다.
    return 1 + Math.max(0, level - 1) * 0.5;
  }

  function getMonsterMaxHp(level) {
    return config.monsters.baseHp + Math.max(0, level - 1) * config.monsters.hpPerLevel;
  }

  global.DungeonLeveling = {
    getXpToNext,
    getMonsterLevel,
    getMonsterXpReward,
    getMonsterDefenseMultiplier,
    getMonsterMaxHp,
  };
})(window);
