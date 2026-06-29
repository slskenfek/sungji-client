// 게임 전역 상수와 초기 밸런스를 관리한다.
// 백엔드의 설정 파일처럼 숫자 규칙과 초기값을 한곳에 모아둔 모듈이다.
(function attachGameConfig(global) {
  global.DungeonConfig = {
    player: {
      // HUD에 표시할 직업명.
      classLabel: "전사",
      // 기본 이동 속도.
      speed: 198,
      // 자동 공격이 닿는 최대 거리.
      attackRange: 78,
      // 공속 계산의 시작값.
      baseAttackRateStage: 1,
      // 공격 쿨타임 기준값(ms).
      attackCooldownBase: 980,
      // 추가 보정 전 기본 데미지.
      baseDamage: 10,
      // 기본 능력치.
      strength: 5,
      dexterity: 2,
      knowledge: 1,
      defense: 7,
      // 기본 자원 수치.
      maxHp: 180,
    },
    equipment: {
      upgradeStatRatio: 0.3,
      bossUpgradeStatRatio: 1.2,
      accessoryEmpoweredLevel: 5,
      accessoryBasicAttackDamageMultiplier: 1.2,
      accessorySplashRadius: 120,
    },
    room: {
      // 현재 방 정보. HUD와 중앙 라벨에 함께 사용된다.
      number: 1,
      label: "Forgotten Hall",
      minMonsterLevel: 1,
    },
    stage: {
      // 풀숲 지대에서 스테이지 번호가 계속 증가하는 반복 진행을 사용한다.
      number: 1,
      label: "풀숲 지대",
      // 일반 몬스터가 쏟아지는 시간(ms).
      waveDuration: 60000,
      // 보스 처치 시 일반 몬스터 대비 몇 배의 경험치를 줄지.
      bossXpMultiplier: 10,
      skillCooldown: 5000,
      skillRadius: 180,
      monsterLevelPerStage: 2,
      monsterHpMultiplierPerStage: 0.35,
      monsterDamageMultiplierPerStage: 0.2,
      monsterDefenseBonusPerStage: 0.15,
      monsterSpeedMultiplierPerStage: 0.04,
      xpRewardMultiplierPerStage: 0.25,
      itemPowerMultiplierPerStage: 0.35,
      spawnRateMultiplierPerStage: 0.05,
    },
    world: {
      // 월드 전체 크기. 카메라 bounds와 스폰 계산의 기준이다.
      width: 2400,
      height: 2400,
    },
    monsters: {
      // 동시에 살아있을 수 있는 몬스터 수.
      maxAlive: 18,
      spawnInterval: 950,
      // 일반 몬스터 체력 공식: baseHp + (level - 1) * hpPerLevel
      baseHp: 30,
      hpPerLevel: 20,
      // 플레이어 주위 랜덤 스폰 반경.
      spawnRadiusMin: 320,
      spawnRadiusMax: 560,
      // 몬스터 이동 속도 범위.
      speedMin: 42,
      speedMax: 68,
      projectileSpeed: 1040,
      // 몬스터 원거리 공격 간격 범위(ms).
      attackIntervalMin: 1200,
      attackIntervalMax: 1800,
      // 몬스터가 공격을 시작하는 거리 범위.
      attackRangeMin: 180,
      attackRangeMax: 340,
      projectileDamage: 10,
      // 보스 능력치 배율.
      bossHpMultiplier: 36,
      bossSpeedMultiplier: 0.82,
      bossProjectileDamageMultiplier: 2.4,
      bossScale: 1.8,
    },
    progression: {
      // 경험치 계산 기준값.
      baseXpToNext: 28,
      xpRewardBase: 12,
    },
  };
})(window);
