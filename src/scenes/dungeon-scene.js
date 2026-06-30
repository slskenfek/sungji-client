// 메인 게임 씬으로 이동, 전투, 스폰, UI 갱신을 조합한다.
// 백엔드 관점에서는 여러 모듈을 조합해 실제 동작을 실행하는 서비스 계층에 가깝다.
(function attachDungeonScene(global) {
  // 다른 파일이 window에 등록한 모듈들을 가져온다.
  const config = global.DungeonConfig;
  const leveling = global.DungeonLeveling;
  const textures = global.DungeonTextures;
  const hudSystem = global.DungeonHud;

  class DungeonScene extends Phaser.Scene {
    constructor() {
      super("DungeonScene");
      // 공격 관련 시간 상태.
      this.attackCooldown = 0;
      this.playerAttackLockedUntil = 0;
      this.skillCooldownUntil = 0;
      this.attackSpeedBuffUntil = 0;
      this.demonModeUntil = 0;
      this.guaranteedCriticalUntil = 0;
      this.lastPlayerVisualState = null;
      this.lastHeavyImpactAt = Number.NEGATIVE_INFINITY;
      this.lastCriticalImpactAt = Number.NEGATIVE_INFINITY;
      this.lastBleedingImpactAt = Number.NEGATIVE_INFINITY;
      this.lastChainEffectAt = Number.NEGATIVE_INFINITY;
      this.lastMeleeVisualAt = Number.NEGATIVE_INFINITY;
      this.lastCombatHudRefreshAt = Number.NEGATIVE_INFINITY;
      this.lastStatusCounterRefreshAt = Number.NEGATIVE_INFINITY;
      this.lastPlayerLevelLabel = null;
      this.hitStopEvent = null;
      this.stageNumber = config.stage.number;
      this.stageStartedAt = 0;
      this.waveEnded = false;
      this.bossSpawned = false;
      this.stageCleared = false;
      this.gameOver = false;
      this.bossMonster = null;
      this.stageClearText = null;
      this.stageClearOverlay = null;
      this.stageClearButtonBounds = null;
      this.stageClearPointerHandler = null;
      this.gameOverOverlay = null;
      this.gameOverRestartBounds = null;
      this.gameOverPointerHandler = null;
      this.lastStageUiSecond = -1;
      this.finalBossActive = false;
      this.finalBossButton = null;
      this.finalBossButtonHandler = null;
      this.awakeningButton = null;
      this.specialBossButtons = [];
      this.activeSpecialBossType = null;
      this.lastInfernoBurnAt = Number.NEGATIVE_INFINITY;
      this.waterDotUntil = 0;
      this.nextWaterDotAt = 0;
      this.activeLegendaryEffects = {
        flameWeapon: false,
        wingedShoes: false,
        empoweredSplash: false,
        physicalGuard: false,
        infernoWeapon: false,
        tidalHelmet: false,
        titanArmor: false,
        tempestShoes: false,
      };
      // 플레이어의 현재 상태 스냅샷.
      // 전투 계산과 HUD 갱신이 모두 이 객체를 기준으로 이뤄진다.
      this.playerState = {
        hp: config.player.maxHp,
        maxHp: config.player.maxHp,
        xp: 0,
        xpToNext: leveling.getXpToNext(1),
        level: 0,
        strength: config.player.strength,
        dexterity: config.player.dexterity,
        knowledge: config.player.knowledge,
        defense: config.player.defense,
        attackRateStage: config.player.baseAttackRateStage,
        attackSpeed: config.player.baseAttackRateStage,
        damage: config.player.baseDamage,
        magicDamage: config.player.knowledge * 10,
        levelDamageBonus: 0,
        levelDefenseBonus: 0,
        isGladiator: false,
        isGladiatorSecondJob: false,
        isAwakened: false,
        equippedItems: {
          weapon: null,
          shoes: null,
          armor: null,
          helmet: null,
          accessory1: null,
          accessory2: null,
        },
        inventory: [],
      };
      // 기본 스탯으로 파생 능력치(공속, 데미지, 최대 HP 등)를 계산한다.
      this.recalculatePlayerStats();
    }

    preload() {
      // Scene에서 사용할 텍스처를 미리 등록한다.
      textures.createTextures(this);
    }

    create() {
      // 월드 -> 엔티티 -> 카메라/UI -> 입력/타이머 순으로 초기화한다.
      this.createMap();
      this.createPlayer();
      this.createGroups();
      this.createCameras();
      this.createAnimations();
      this.createUi();
      this.registerInputs();
      this.registerFinalBossButton();
      this.registerSpecialBossButtons();
      this.startStage();
      this.startMonsterSpawner();
    }

    createMap() {
      // 플레이어와 오브젝트가 움직일 수 있는 물리 월드 경계.
      this.physics.world.setBounds(0, 0, config.world.width, config.world.height);

      // 잔디 배경.
      const background = this.add.graphics();
      background.fillGradientStyle(0x477b3e, 0x5f9b4f, 0x243f2b, 0x1f3525, 1);
      background.fillRect(0, 0, config.world.width, config.world.height);
      background.fillStyle(0xa1d494, 0.1);
      for (let i = 0; i < 180; i += 1) {
        const size = Phaser.Math.Between(40, 120);
        background.fillCircle(
          Phaser.Math.Between(0, config.world.width),
          Phaser.Math.Between(0, config.world.height),
          size
        );
      }

      background.lineStyle(2, 0xffe2ab, 0.24);
      background.strokeRoundedRect(300, 300, 1800, 1800, 42);
      background.lineStyle(3, 0xffbf00, 0.3);
      background.strokeRoundedRect(540, 540, 1320, 1320, 28);

      // 십자형 흙길. 플레이 동선과 미니맵 가독성을 동시에 담당한다.
      const trail = this.add.graphics();
      trail.fillStyle(0x8c6a42, 0.9);
      trail.fillRoundedRect(1120, 360, 160, 1680, 46);
      trail.fillRoundedRect(560, 1120, 1280, 160, 46);
      trail.fillStyle(0xffe2ab, 0.17);
      trail.fillRoundedRect(1152, 388, 96, 1624, 38);
      trail.fillRoundedRect(588, 1152, 1224, 96, 38);

      // 방 외곽 느낌을 주는 배경 패널/테두리.
      const roomGraphics = this.add.graphics();
      roomGraphics.fillStyle(0x1f3424, 0.5);
      roomGraphics.fillRoundedRect(332, 332, 1736, 1736, 42);
      roomGraphics.lineStyle(4, 0x1a1a1b, 0.9);
      roomGraphics.strokeRoundedRect(360, 360, 1680, 1680, 36);
      roomGraphics.lineStyle(2, 0xffe2ab, 0.38);
      roomGraphics.strokeRoundedRect(402, 402, 1596, 1596, 32);

      // 나무/연못/수풀 등 지형지물 배치.
      this.decorateTerrain();

      // 월드 상단 중앙에 보이는 방 이름 라벨.
      this.roomLabel = this.add
        .text(1200, 220, "ROOM 01", {
          fontFamily: "Plus Jakarta Sans, Segoe UI",
          fontSize: "42px",
          color: "#ffe2ab",
          fontStyle: "700",
          stroke: "#1a1a1b",
          strokeThickness: 6,
        })
        .setOrigin(0.5);
    }

    decorateTerrain() {
      // 고정 좌표 오브젝트는 맵 레이아웃을 안정적으로 유지하기 쉽다.
      const treePositions = [
        [470, 470], [710, 430], [930, 450], [1460, 440], [1730, 470], [1940, 520],
        [460, 1840], [690, 1940], [930, 1960], [1500, 1940], [1760, 1900], [1950, 1820],
        [420, 760], [1960, 780], [420, 1490], [1980, 1470],
      ];
      treePositions.forEach(([x, y]) => {
        const tree = this.add.image(x, y, "terrain-tree").setDepth(8);
        tree.setScale(Phaser.Math.FloatBetween(0.92, 1.12));
      });

      // 연못은 미니맵에서 위치를 읽기 쉬운 랜드마크 역할을 한다.
      const pondPositions = [
        [760, 760],
        [1640, 760],
        [760, 1640],
        [1640, 1640],
      ];
      pondPositions.forEach(([x, y]) => {
        const pond = this.add.image(x, y, "terrain-pond").setDepth(4);
        pond.setScale(Phaser.Math.FloatBetween(0.92, 1.08));
      });

      // 수풀은 길 주변 밀도를 높여 풀숲 분위기를 만든다.
      const bushPositions = [
        [585, 620], [870, 620], [1530, 620], [1810, 640],
        [620, 1020], [1780, 1020], [620, 1380], [1780, 1380],
        [590, 1770], [850, 1795], [1540, 1785], [1810, 1760],
        [1030, 585], [1370, 585], [1020, 1810], [1380, 1810],
      ];
      bushPositions.forEach(([x, y], index) => {
        const bush = this.add.image(x, y, "terrain-bush").setDepth(7);
        bush.setScale(0.88 + (index % 3) * 0.08);
      });

      // 바위는 공간이 비어 보이지 않도록 끊어주는 보조 오브젝트.
      const rockPositions = [
        [1040, 735], [1360, 760], [1040, 1670], [1360, 1650],
        [720, 1200], [1680, 1200], [1200, 620], [1200, 1790],
      ];
      rockPositions.forEach(([x, y]) => {
        const rock = this.add.image(x, y, "terrain-rock").setDepth(6);
        rock.setScale(Phaser.Math.FloatBetween(0.85, 1.15));
      });

      // 꽃은 랜덤 배치라서 매번 약간 다른 배경 디테일을 만든다.
      for (let i = 0; i < 48; i += 1) {
        const flower = this.add.image(
          Phaser.Math.Between(430, 1970),
          Phaser.Math.Between(430, 1970),
          "terrain-flower"
        ).setDepth(5);
        flower.setScale(Phaser.Math.FloatBetween(0.75, 1.1));
      }
    }

    createPlayer() {
      // 플레이어 본체는 physics sprite로 생성한다.
      this.player = this.physics.add.sprite(1200, 1200, "warrior-idle");
      this.player.setCollideWorldBounds(true);
      this.player.setSize(28, 36);
      this.player.setOffset(18, 20);
      this.player.setDepth(20);

      this.legendaryWings = this.add.graphics().setDepth(18).setVisible(false);
      this.legendaryWings.fillStyle(0xeaf7ff, 0.92);
      this.legendaryWings.fillTriangle(-8, 0, -42, -20, -28, 14);
      this.legendaryWings.fillTriangle(8, 0, 42, -20, 28, 14);
      this.legendaryWings.fillStyle(0x79d0ff, 0.72);
      this.legendaryWings.fillTriangle(-12, 6, -38, 2, -24, 22);
      this.legendaryWings.fillTriangle(12, 6, 38, 2, 24, 22);
      this.legendaryArmorAura = this.add.circle(this.player.x, this.player.y, 29, 0x79d0ff, 0.08)
        .setStrokeStyle(2, 0xb8e6ff, 0.72)
        .setDepth(19)
        .setVisible(false);

      this.promotionAura = this.add.circle(this.player.x, this.player.y, 34, 0xffdc73, 0.18)
        .setStrokeStyle(3, 0xfff4b0, 0.82)
        .setDepth(19)
        .setVisible(false);
      this.tweens.add({
        targets: this.promotionAura,
        scaleX: 1.28,
        scaleY: 1.28,
        alpha: 0.42,
        duration: 620,
        yoyo: true,
        repeat: -1,
      });

      // 플레이어 머리 위에 붙는 레벨 표시.
      this.playerLevelText = this.add.text(this.player.x, this.player.y - 52, "LV:0", {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "12px",
        color: "#fffdd0",
        fontStyle: "700",
        stroke: "#1a1a1b",
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(32);
    }

    createGroups() {
      // 몬스터와 투사체를 종류별로 묶어 관리한다.
      this.monsters = this.physics.add.group();
      this.enemyProjectiles = this.physics.add.group();

      // 투사체와 플레이어가 겹치면 피격 처리.
      this.physics.add.overlap(this.player, this.enemyProjectiles, this.handleProjectileHit, null, this);
    }

    createCameras() {
      // 메인 카메라는 실제 플레이 화면.
      this.cameras.main.setBounds(0, 0, config.world.width, config.world.height);
      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      this.cameras.main.setZoom(1.22);

      // 미니맵 카메라는 같은 월드를 축소해서 한 번 더 보여주는 보조 카메라.
      this.miniMapCamera = this.cameras.add(1016, 24, 240, 150).setZoom(0.13);
      this.miniMapCamera.setBounds(0, 0, config.world.width, config.world.height);
      this.miniMapCamera.startFollow(this.player, true, 0.14, 0.14);
      this.miniMapCamera.setBackgroundColor(0x36552d);
    }

    createAnimations() {
      // 텍스처 key 배열을 묶어 이동 애니메이션을 정의한다.
      if (!this.anims.exists("warrior-run")) {
        this.anims.create({
          key: "warrior-run",
          frames: [
            { key: "warrior-move-a" },
            { key: "warrior-idle" },
            { key: "warrior-move-b" },
            { key: "warrior-idle" },
          ],
          frameRate: 8,
          repeat: -1,
        });
      }

      if (!this.anims.exists("gladiator-run")) {
        this.anims.create({
          key: "gladiator-run",
          frames: [
            { key: "gladiator-move-a" },
            { key: "gladiator-idle" },
            { key: "gladiator-move-b" },
            { key: "gladiator-idle" },
          ],
          frameRate: 10,
          repeat: -1,
        });
      }

      if (!this.anims.exists("gladiator-fire-run")) {
        this.anims.create({
          key: "gladiator-fire-run",
          frames: [
            { key: "gladiator-fire-move-a" },
            { key: "gladiator-fire-idle" },
            { key: "gladiator-fire-move-b" },
            { key: "gladiator-fire-idle" },
          ],
          frameRate: 10,
          repeat: -1,
        });
      }

      for (let index = 0; index < 3; index += 1) {
        if (!this.anims.exists(`monster-${index}-run`)) {
          this.anims.create({
            key: `monster-${index}-run`,
            frames: [
              { key: `monster-${index}-move-a` },
              { key: `monster-${index}-idle` },
              { key: `monster-${index}-move-b` },
              { key: `monster-${index}-idle` },
            ],
            frameRate: 7,
            repeat: -1,
          });
        }
      }

      if (!this.anims.exists("boss-run")) {
        this.anims.create({
          key: "boss-run",
          frames: [
            { key: "boss-move-a" },
            { key: "boss-idle" },
            { key: "boss-move-b" },
            { key: "boss-idle" },
          ],
          frameRate: 6,
          repeat: -1,
        });
      }
    }

    createUi() {
      // HUD 생성 후, 미니맵 카메라에서는 HUD가 안 보이도록 제외 처리한다.
      this.hud = hudSystem.createHud(this);
      this.miniMapCamera.ignore(hudSystem.getHudElementsToIgnore(this.hud));
      this.refreshUi(true);
    }

    startStage() {
      this.clearStageClearInput();
      this.stageStartedAt = this.time.now;
      this.waveEnded = false;
      this.bossSpawned = false;
      this.stageCleared = false;
      this.bossMonster = null;
      this.finalBossActive = false;
      this.activeSpecialBossType = null;
      this.lastStageUiSecond = -1;
      this.stageClearText?.destroy();
      this.stageClearText = null;
      this.stageClearOverlay?.destroy();
      this.stageClearOverlay = null;
      this.refreshUi();
      this.updateFinalBossButton();
      this.updateSpecialBossButtons();
    }

    registerInputs() {
      // 화살표 키와 WASD를 함께 지원한다.
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D,SHIFT");
      this.skillKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
    }

    registerFinalBossButton() {
      this.finalBossButton = document.getElementById("summon-final-boss");
      if (!this.finalBossButton) {
        return;
      }

      this.finalBossButtonHandler = () => this.summonFinalBoss();
      this.finalBossButton.addEventListener("click", this.finalBossButtonHandler);
      this.events.once("shutdown", () => {
        this.finalBossButton?.removeEventListener("click", this.finalBossButtonHandler);
      });
      this.updateFinalBossButton();
    }

    registerSpecialBossButtons() {
      this.awakeningButton = document.getElementById("awakening-challenge");
      const awakeningHandler = () => this.summonSpecialBoss("awakening");
      this.awakeningButton?.addEventListener("click", awakeningHandler);

      this.specialBossButtons = Array.from(document.querySelectorAll("[data-supreme-boss]"));
      const supremeHandlers = this.specialBossButtons.map((button) => {
        const handler = () => this.summonSpecialBoss(button.dataset.supremeBoss);
        button.addEventListener("click", handler);
        return { button, handler };
      });

      this.events.once("shutdown", () => {
        this.awakeningButton?.removeEventListener("click", awakeningHandler);
        supremeHandlers.forEach(({ button, handler }) => button.removeEventListener("click", handler));
      });
      this.updateSpecialBossButtons();
    }

    updateSpecialBossButtons() {
      const battleLocked = this.gameOver || this.stageCleared || this.bossSpawned;
      if (this.awakeningButton) {
        const eligible = this.playerState.isGladiatorSecondJob && !this.playerState.isAwakened;
        this.awakeningButton.disabled = battleLocked || !eligible;
        this.awakeningButton.textContent = this.playerState.isAwakened
          ? "각성 완료"
          : this.activeSpecialBossType === "awakening"
            ? "각성 도전 중"
            : eligible ? "각성 도전" : "2차 환생 필요";
      }
      this.specialBossButtons.forEach((button) => {
        const type = button.dataset.supremeBoss;
        button.disabled = battleLocked;
        if (this.activeSpecialBossType === type) {
          button.textContent = `${this.getSupremeBossProfile(type).label} 전투 중`;
        } else {
          button.textContent = `${this.getSupremeBossProfile(type).label} 최강 보스`;
        }
      });
    }

    updateFinalBossButton() {
      if (!this.finalBossButton) {
        return;
      }

      this.finalBossButton.disabled = this.gameOver || this.stageCleared || this.bossSpawned;
      this.finalBossButton.textContent = this.finalBossActive
        ? "최종 보스 전투 중"
        : this.bossSpawned
          ? "보스 전투 중"
          : "최종 보스 소환";
      this.updateSpecialBossButtons();
    }

    summonFinalBoss() {
      if (this.gameOver || this.stageCleared || this.finalBossActive) {
        return;
      }

      this.monsterSpawner?.remove(false);
      this.waveEnded = true;
      this.bossSpawned = false;
      this.bossMonster = null;
      this.spawnBoss(true);
    }

    startMonsterSpawner() {
      // 일정 주기마다 spawnMonster를 호출하는 타이머 등록.
      this.monsterSpawner = this.time.addEvent({
        delay: this.getStageSpawnInterval(),
        loop: true,
        callback: () => {
          if (this.waveEnded || this.stageCleared) {
            return;
          }
          this.spawnMonster();
        },
      });
    }

    refreshUi(renderInventory = false) {
      // playerState 값을 HUD에 반영하는 얇은 진입점.
      hudSystem.refreshHud(this, this.hud);
      if (renderInventory) {
        this.renderInventory();
      }
    }

    getStageElapsedTime() {
      return Math.max(0, this.time.now - this.stageStartedAt);
    }

    getProgressionXpMultiplier() {
      if (this.playerState.isAwakened) {
        return config.progression.awakenedXpMultiplier;
      }
      if (this.playerState.isGladiatorSecondJob) {
        return config.progression.secondJobXpMultiplier;
      }
      if (this.playerState.isGladiator) {
        return config.progression.gladiatorXpMultiplier;
      }
      return 1;
    }

    getStageNumber() {
      return this.stageNumber;
    }

    getPlayerClassLabel() {
      if (this.playerState.isAwakened) {
        return config.player.promotion.awakening.classLabel;
      }
      if (this.playerState.isGladiatorSecondJob) {
        return config.player.promotion.secondJobClassLabel;
      }
      return this.playerState.isGladiator
        ? config.player.promotion.classLabel
        : config.player.classLabel;
    }

    getPlayerTextureKey(pose) {
      if (this.playerState.isGladiator && this.activeLegendaryEffects.flameWeapon) {
        return `gladiator-fire-${pose}`;
      }
      return `${this.playerState.isGladiator ? "gladiator" : "warrior"}-${pose}`;
    }

    getPlayerRunAnimationKey() {
      if (this.playerState.isGladiator && this.activeLegendaryEffects.flameWeapon) {
        return "gladiator-fire-run";
      }
      return this.playerState.isGladiator ? "gladiator-run" : "warrior-run";
    }

    getPlayerAttackRange() {
      const calculatedRange = config.player.attackRange * (
        this.playerState.isGladiator ? config.player.promotion.attackRangeMultiplier : 1
      ) * (this.activeLegendaryEffects.tidalHelmet ? config.equipment.tidalAttackRangeMultiplier : 1);
      return this.playerState.isAwakened
        ? Math.min(calculatedRange, config.player.promotion.awakening.maximumAttackRange)
        : calculatedRange;
    }

    isMilestoneBossStage() {
      return this.stageNumber % config.stage.milestoneBossStageInterval === 0;
    }

    getStageScale(perStageIncrease) {
      return 1 + Math.max(0, this.stageNumber - 1) * perStageIncrease;
    }

    getStageMinimumMonsterLevel() {
      return config.room.minMonsterLevel + (this.stageNumber - 1) * config.stage.monsterLevelPerStage;
    }

    getStageSpawnInterval() {
      return Math.max(
        360,
        Math.round(config.monsters.spawnInterval / this.getStageScale(config.stage.spawnRateMultiplierPerStage))
      );
    }

    getRemainingWaveTime() {
      return Math.max(0, config.stage.waveDuration - this.getStageElapsedTime());
    }

    getClockText() {
      const totalSeconds = Math.ceil(this.getRemainingWaveTime() / 1000);
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");

      if (this.stageCleared) {
        return "CLEAR";
      }

      if (this.bossSpawned) {
        return this.finalBossActive ? "FINAL" : "BOSS";
      }

      return `${minutes}:${seconds}`;
    }

    getSkillStatusText() {
      if (this.time.now < this.guaranteedCriticalUntil) {
        const seconds = Math.ceil((this.guaranteedCriticalUntil - this.time.now) / 1000);
        return `확정 크리티컬 ${seconds}s`;
      }

      if (this.time.now < this.demonModeUntil) {
        const seconds = Math.ceil((this.demonModeUntil - this.time.now) / 1000);
        return `악마모드 ${seconds}s`;
      }

      if (this.time.now >= this.skillCooldownUntil) {
        return "READY";
      }

      const seconds = Math.ceil((this.skillCooldownUntil - this.time.now) / 1000);
      return `${seconds}s`;
    }

    getSkillProfile() {
      if (this.playerState.isGladiator) {
        return {
          name: this.playerState.isGladiatorSecondJob ? "악마모드 II" : "악마모드",
          color: 0x7d1634,
          accent: 0xff4c64,
          multiplier: 0,
          attackSpeedBuff: false,
          cooldown: config.player.promotion.demonModeCooldown,
        };
      }

      if (this.playerState.level >= 10) {
        return {
          name: "불기둥",
          color: 0xff6d2d,
          accent: 0xffbf00,
          multiplier: 3.8,
          attackSpeedBuff: true,
        };
      }

      if (this.playerState.level >= 5) {
        return {
          name: "번개",
          color: 0x79d0ff,
          accent: 0xfffdd0,
          multiplier: 2.35,
          attackSpeedBuff: true,
        };
      }

      return {
        name: "함성",
        color: 0xffd36e,
        accent: 0xfffdd0,
        multiplier: 1.25,
        attackSpeedBuff: false,
      };
    }

    getEffectiveAttackRateStage(time = this.time.now) {
      const demonMultiplier = time < this.demonModeUntil
        ? config.player.promotion.demonModeAttackSpeedMultiplier
        : 1;
      const buffMultiplier = time < this.attackSpeedBuffUntil ? 1.2 : 1;
      return this.playerState.attackRateStage * buffMultiplier * demonMultiplier;
    }

    getStageStatusText() {
      if (this.stageCleared) {
        return "CLEAR";
      }

      if (this.bossSpawned) {
        return this.finalBossActive ? "최종 보스 등장" : "BOSS 등장";
      }

      const seconds = Math.ceil(this.getRemainingWaveTime() / 1000);
      return `보스까지 ${String(seconds).padStart(2, "0")}초`;
    }

    getStageWorldLabel() {
      if (this.stageCleared) {
        return `STAGE ${String(this.stageNumber).padStart(2, "0")} CLEAR`;
      }

      if (this.bossSpawned) {
        return `${this.finalBossActive ? "FINAL BOSS" : "BOSS"} | ${config.stage.label}`;
      }

      return `STAGE ${String(this.stageNumber).padStart(2, "0")}`;
    }

    updateStageFlow() {
      if (this.gameOver || this.stageCleared || this.bossSpawned) {
        return;
      }

      const remainingSeconds = Math.ceil(this.getRemainingWaveTime() / 1000);
      if (remainingSeconds !== this.lastStageUiSecond) {
        this.lastStageUiSecond = remainingSeconds;
        this.refreshUi();
      }

      if (this.getStageElapsedTime() >= config.stage.waveDuration) {
        this.waveEnded = true;
        this.monsterSpawner?.remove(false);
        this.spawnBoss();
      }
    }

    clearStage() {
      if (this.gameOver || this.stageCleared) {
        return;
      }

      this.stageCleared = true;
      this.waveEnded = true;
      this.monsterSpawner?.remove(false);
      this.removeActiveEnemies();

      this.stageClearText?.destroy();
      this.stageClearText = null;
      this.showStageClearOverlay();
      this.refreshUi(true);
      this.updateFinalBossButton();
    }

    showStageClearOverlay() {
      this.clearStageClearInput();
      this.stageClearOverlay?.destroy();

      const overlay = this.add.container(640, 360).setScrollFactor(0).setDepth(1500);
      const dim = this.add.rectangle(0, 0, 1280, 720, 0x061008, 0.58);
      const panel = this.add.graphics();
      panel.fillStyle(0x1a1a1b, 0.98);
      panel.fillRoundedRect(-260, -158, 520, 316, 16);
      panel.fillStyle(0x1b3421, 0.98);
      panel.fillRoundedRect(-252, -150, 504, 300, 12);
      panel.lineStyle(3, 0xffe2ab, 0.82);
      panel.strokeRoundedRect(-252, -150, 504, 300, 12);

      const title = this.add.text(0, -92, "STAGE CLEAR!", {
        fontFamily: "Segoe UI",
        fontSize: "46px",
        color: "#fff1ad",
        fontStyle: "700",
        stroke: "#37501f",
        strokeThickness: 8,
      }).setOrigin(0.5);
      const rewardText = this.add.text(
        0,
        -28,
        `STAGE ${this.stageNumber} 완료\n장비·인벤토리·레벨이 다음 스테이지에 유지됩니다`,
        {
          fontFamily: "Plus Jakarta Sans, Segoe UI",
          fontSize: "17px",
          color: "#d9f3c5",
          fontStyle: "700",
          align: "center",
          lineSpacing: 8,
        }
      ).setOrigin(0.5);
      const nextButtonBg = this.add.rectangle(0, 76, 292, 60, 0xffbf00, 1)
        .setStrokeStyle(3, 0x1a1a1b, 1)
        .setInteractive({ useHandCursor: true });
      const nextButton = this.add.text(0, 76, "다음 스테이지 넘어가기", {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "19px",
        color: "#402d00",
        fontStyle: "800",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const setButtonScale = (scale) => {
        nextButtonBg.setScale(scale);
        nextButton.setScale(scale);
      };
      const goNext = () => this.goToNextStage();
      nextButtonBg.on("pointerover", () => setButtonScale(1.04));
      nextButtonBg.on("pointerout", () => setButtonScale(1));
      nextButtonBg.on("pointerdown", goNext);
      nextButton.on("pointerover", () => setButtonScale(1.04));
      nextButton.on("pointerout", () => setButtonScale(1));
      nextButton.on("pointerdown", goNext);

      overlay.add([dim, panel, title, rewardText, nextButtonBg, nextButton]);
      this.stageClearOverlay = overlay;
      // 카메라 줌과 Container가 함께 적용되면 자식 객체의 hit test가 누락될 수 있다.
      // 게임 좌표 기준의 Scene 입력을 함께 등록해 버튼 클릭을 안정적으로 처리한다.
      this.stageClearButtonBounds = new Phaser.Geom.Rectangle(494, 406, 292, 60);
      this.stageClearPointerHandler = (pointer) => {
        if (!this.stageCleared || !this.stageClearButtonBounds?.contains(pointer.x, pointer.y)) {
          return;
        }

        this.goToNextStage();
      };
      this.input.on("pointerdown", this.stageClearPointerHandler);
    }

    clearStageClearInput() {
      if (this.stageClearPointerHandler) {
        this.input.off("pointerdown", this.stageClearPointerHandler);
      }
      this.stageClearPointerHandler = null;
      this.stageClearButtonBounds = null;
    }

    goToNextStage() {
      if (this.gameOver || !this.stageCleared) {
        return;
      }

      this.monsterSpawner?.remove(false);
      this.clearStageClearInput();
      this.stageClearOverlay?.destroy();
      this.stageClearOverlay = null;
      this.stageNumber += 1;
      this.removeActiveEnemies();
      this.recalculatePlayerStats();
      this.playerState.hp = this.playerState.maxHp;
      this.attackCooldown = 0;
      this.playerAttackLockedUntil = 0;
      this.skillCooldownUntil = 0;
      this.attackSpeedBuffUntil = 0;
      this.demonModeUntil = 0;
      this.guaranteedCriticalUntil = 0;
      this.player.setPosition(1200, 1200);
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.applyPlayerAppearance();
      this.startStage();
      this.startMonsterSpawner();
      this.refreshUi(true);
    }

    removeActiveEnemies({ keepBoss = false } = {}) {
      this.monsters.getChildren().forEach((monster) => {
        if (!monster.active) {
          return;
        }

        if (keepBoss && monster.getData("isBoss")) {
          return;
        }

        monster.getData("hpBar")?.destroy();
        monster.getData("levelText")?.destroy();
        monster.destroy();
      });

      this.enemyProjectiles.getChildren().forEach((projectile) => {
        if (projectile.active) {
          projectile.destroy();
        }
      });
    }

    recalculatePlayerStats() {
      // 기본값 대비 증가분을 이용해 파생 능력치를 다시 계산한다.
      this.refreshLegendaryEffects();
      const strengthDelta = this.playerState.strength - config.player.strength;
      const dexterityDelta = this.playerState.dexterity - config.player.dexterity;
      const knowledgeDelta = this.playerState.knowledge - config.player.knowledge;
      const equipmentStats = this.getEquippedStats();

      this.playerState.attackRateStage = Number(
        (config.player.baseAttackRateStage + (dexterityDelta + equipmentStats.dexterity) * 0.12).toFixed(2)
      );
      this.playerState.attackSpeed = this.playerState.attackRateStage;
      this.playerState.damage = Number(
        (
          (
            config.player.baseDamage +
            this.playerState.levelDamageBonus +
            (strengthDelta + equipmentStats.strength) * 0.65 +
            equipmentStats.damage
          ) *
          (this.playerState.isGladiator ? config.player.promotion.damageMultiplier : 1) *
          (this.activeLegendaryEffects.flameWeapon ? config.equipment.finalWeaponDamageMultiplier : 1)
        ).toFixed(2)
      );
      this.playerState.defense = Number(
        (
          config.player.defense +
          this.playerState.levelDefenseBonus +
          (dexterityDelta + equipmentStats.dexterity) * 0.3 +
          equipmentStats.defense
        ).toFixed(2)
      );
      if (this.activeLegendaryEffects.titanArmor) {
        this.playerState.defense += this.playerState.strength * config.equipment.titanDefensePerStrength;
      }
      this.playerState.maxHp = config.player.maxHp + (strengthDelta + equipmentStats.strength) * 5;
      this.playerState.magicDamage =
        knowledgeDelta + equipmentStats.knowledge >= 0
          ? (config.player.knowledge + knowledgeDelta + equipmentStats.knowledge) * 7
          : 0;
    }

    spawnMonster() {
      // 몬스터 수가 가득 찼으면 더 생성하지 않는다.
      if (this.monsters.countActive(true) >= config.monsters.maxAlive) {
        return;
      }

      if (this.gameOver) {
        return;
      }

      // 플레이어 주변 랜덤 원형 범위에서 생성한다.
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(config.monsters.spawnRadiusMin, config.monsters.spawnRadiusMax);
      const spawnX = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 100, config.world.width - 100);
      const spawnY = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 100, config.world.height - 100);
      const monsterLevel = leveling.getMonsterLevel(this.playerState.level, this.getStageMinimumMonsterLevel());
      const awakenedStats = config.monsters.awakened;
      const awakeningHpMultiplier = this.playerState.isAwakened ? awakenedStats.hpMultiplier : 1;
      const monsterMaxHp = Math.round(
        leveling.getMonsterMaxHp(monsterLevel) *
          this.getStageScale(config.stage.monsterHpMultiplierPerStage) *
          awakeningHpMultiplier
      );

      const variant = this.getMonsterVariantByLevel(monsterLevel);
      const monster = this.physics.add.sprite(spawnX, spawnY, `monster-${variant}-idle`);
      // setData는 엔티티별 상태를 저장하는 간단한 key-value 저장소처럼 쓴다.
      monster.setDepth(18);
      monster.setScale(
        this.getMonsterScaleByLevel(monsterLevel) *
          (this.playerState.isAwakened ? awakenedStats.scaleMultiplier : 1)
      );
      monster.setData("variant", variant);
      monster.setData("speciesName", this.getMonsterSpeciesName(variant));
      monster.setData("level", monsterLevel);
      monster.setData(
        "nameLabel",
        `${this.playerState.isAwakened ? "각성 " : ""}LV${monsterLevel} ${this.getMonsterSpeciesName(variant)}`
      );
      monster.setData(
        "defenseMultiplier",
        (leveling.getMonsterDefenseMultiplier(monsterLevel) +
          (this.stageNumber - 1) * config.stage.monsterDefenseBonusPerStage) *
          (this.playerState.isAwakened ? awakenedStats.defenseMultiplier : 1)
      );
      monster.setData("hp", monsterMaxHp);
      monster.setData("maxHp", monsterMaxHp);
      monster.setData(
        "speed",
        Math.round(
          Phaser.Math.Between(config.monsters.speedMin, config.monsters.speedMax) *
            this.getStageScale(config.stage.monsterSpeedMultiplierPerStage) *
            (this.playerState.isAwakened ? awakenedStats.speedMultiplier : 1)
        )
      );
      monster.setData("attackRange", Phaser.Math.Between(config.monsters.attackRangeMin, config.monsters.attackRangeMax));
      monster.setData("nextShotAt", this.time.now + Phaser.Math.Between(config.monsters.attackIntervalMin, config.monsters.attackIntervalMax));

      const hpBar = this.add.graphics().setDepth(30);
      const levelText = this.add.text(monster.x, monster.y - 44, `LV${monsterLevel} ${this.getMonsterSpeciesName(variant)}`, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "11px",
        color: "#fffdd0",
        stroke: "#1a1a1b",
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(31);

      monster.setData("hpBar", hpBar);
      monster.setData("levelText", levelText);
      this.monsters.add(monster);
    }

    getMonsterVariantByLevel(level) {
      if (level <= 1) {
        return 0;
      }

      if (level === 2) {
        return 1;
      }

      return 2;
    }

    getMonsterSpeciesName(variant) {
      return ["토끼", "멧돼지", "박쥐냥"][variant] || "몬스터";
    }

    getMonsterScaleByLevel(level) {
      return Phaser.Math.Clamp(1 + (level - 1) * 0.08, 1, 1.28);
    }

    getEquipmentSlots() {
      return [
        { key: "weapon", label: "무기", icon: "weapon" },
        { key: "helmet", label: "투구", icon: "helmet" },
        { key: "armor", label: "갑옷", icon: "armor" },
        { key: "shoes", label: "신발", icon: "shoes" },
        { key: "accessory1", label: "악세사리 1", icon: "accessory1" },
        { key: "accessory2", label: "악세사리 2", icon: "accessory2" },
      ];
    }

    getEquippedStats() {
      return Object.values(this.playerState.equippedItems).reduce(
        (total, item) => {
          if (!item) {
            return total;
          }

          Object.entries(item.stats).forEach(([key, value]) => {
            total[key] = (total[key] || 0) + value;
          });
          return total;
        },
        { damage: 0, strength: 0, dexterity: 0, knowledge: 0, defense: 0 }
      );
    }

    refreshLegendaryEffects() {
      Object.keys(this.activeLegendaryEffects).forEach((effect) => {
        this.activeLegendaryEffects[effect] = false;
      });
      Object.values(this.playerState.equippedItems).forEach((item) => {
        if (item?.finalLegendaryEffect in this.activeLegendaryEffects) {
          this.activeLegendaryEffects[item.finalLegendaryEffect] = true;
        }
      });
    }

    maybeAutoLootEquipment(level, isBoss, isFinalBoss = false) {
      const shouldDrop = isBoss || isFinalBoss || Phaser.Math.Between(1, 100) <= 30;
      if (!shouldDrop) {
        return;
      }

      const item = this.createEquipmentItem(level, isBoss, isFinalBoss);
      this.playerState.inventory.unshift(item);
      this.renderInventory();
      this.showLootToast(item);
    }

    createEquipmentItem(level, isBoss, isFinalBoss = false) {
      const rarityRoll = isBoss ? 100 : Phaser.Math.Between(1, 100);
      const rarity =
        isFinalBoss ? "최강" :
        isBoss ? "신화" :
        rarityRoll >= 99 ? "최강" :
        rarityRoll >= 93 ? "신화" :
        rarityRoll >= 80 ? "전설" :
        rarityRoll >= 55 ? "에픽" :
        "레어";
      const rarityPower = { 레어: 1, 에픽: 1.5, 전설: 2.2, 신화: 3.2, 최강: 4.8 }[rarity];
      const levelPower = isBoss
        ? Math.max(40, Math.round(Math.pow(Math.max(1, level), 1.7) * 14))
        : Math.max(1, Math.round(Math.pow(Math.max(1, level), 1.35) * rarityPower));
      const scaledLevelPower = Math.round(
        levelPower * this.getStageScale(config.stage.itemPowerMultiplierPerStage)
      );
      const templates = [
        { type: "weapon", name: "전사의 검", stats: { damage: 4 + scaledLevelPower * 2, strength: Math.ceil(scaledLevelPower / 3) } },
        { type: "shoes", name: "가죽 신발", stats: { dexterity: 1 + Math.ceil(scaledLevelPower / 2), defense: Math.ceil(scaledLevelPower / 4) } },
        { type: "armor", name: "은빛 갑옷", stats: { defense: 3 + scaledLevelPower, strength: Math.ceil(scaledLevelPower / 4) } },
        { type: "helmet", name: "강철 투구", stats: { defense: 2 + scaledLevelPower, knowledge: Math.ceil(scaledLevelPower / 5) } },
        { type: "accessory", name: "번개의 반지", stats: { damage: 1 + scaledLevelPower, dexterity: Math.ceil(scaledLevelPower / 3) } },
        { type: "accessory", name: "푸른 보석 목걸이", stats: { knowledge: Math.ceil(scaledLevelPower / 2), damage: Math.ceil(scaledLevelPower / 2) } },
      ];
      const template = Phaser.Utils.Array.GetRandom(templates);

      return {
        id: `${Date.now()}-${Phaser.Math.Between(1000, 9999)}`,
        name: `${isFinalBoss ? "최강" : isBoss ? "신화" : rarity} ${template.name}`,
        baseName: template.name,
        upgradeLevel: 0,
        type: template.type,
        level,
        rarity,
        isBossDrop: isBoss,
        isFinalBossDrop: isFinalBoss,
        acquiredStage: this.stageNumber,
        stats: template.stats,
        baseStats: { ...template.stats },
      };
    }

    equipItem(index) {
      const nextItem = this.playerState.inventory[index];
      if (!nextItem) {
        return;
      }

      if (this.tryUpgradeSameEquipment(nextItem, index)) {
        return;
      }

      const slotKey = this.getTargetEquipmentSlot(nextItem);
      if (!slotKey) {
        return;
      }

      this.playerState.inventory.splice(index, 1);
      const previousItem = this.playerState.equippedItems[slotKey];
      if (previousItem) {
        this.playerState.inventory.unshift(previousItem);
      }

      this.playerState.equippedItems[slotKey] = nextItem;
      this.recalculatePlayerStats();
      this.playerState.hp = Math.min(this.playerState.hp, this.playerState.maxHp);
      this.applyPlayerAppearance();
      this.refreshUi(true);
    }

    tryUpgradeSameEquipment(nextItem, inventoryIndex) {
      const sameSlotKey = this.findUpgradeableEquipmentSlot(nextItem);

      if (!sameSlotKey) {
        return false;
      }

      const equippedItem = this.playerState.equippedItems[sameSlotKey];
      const upgradeSucceeded = nextItem.isFinalBossDrop || nextItem.isSupremeBossDrop ||
        Phaser.Math.Between(1, 100) <= config.equipment.upgradeSuccessRate * 100;
      // 강화 시도에 사용한 재료는 성공 여부와 관계없이 소모한다.
      this.playerState.inventory.splice(inventoryIndex, 1);
      if (!upgradeSucceeded) {
        this.showSystemToast(`강화 실패 · ${nextItem.name} 소멸`, "#ff8f8f");
        this.refreshUi(true);
        return true;
      }

      const upgradeRatio = nextItem.isFinalBossDrop
        ? config.equipment.finalBossUpgradeStatRatio
        : nextItem.isBossDrop
          ? config.equipment.bossUpgradeStatRatio
          : config.equipment.upgradeStatRatio;
      equippedItem.upgradeLevel = (equippedItem.upgradeLevel || 0) + 1;
      Object.entries(nextItem.stats).forEach(([key, value]) => {
        equippedItem.stats[key] = Number(
          ((equippedItem.stats[key] || 0) + value * upgradeRatio).toFixed(2)
        );
      });
      equippedItem.name = this.getUpgradedItemName(equippedItem);
      let unlockedEffectLabel = "";
      if (nextItem.isFinalBossDrop) {
        this.applyFinalLegendaryEffect(equippedItem);
        unlockedEffectLabel = this.getFinalLegendaryEffectLabel(equippedItem);
      }
      if (nextItem.isSupremeBossDrop) {
        equippedItem.finalLegendaryEffect = nextItem.supremeLegendaryEffect;
        unlockedEffectLabel = this.getFinalLegendaryEffectLabel(equippedItem);
      }

      this.recalculatePlayerStats();
      this.playerState.hp = Math.min(this.playerState.hp, this.playerState.maxHp);
      this.applyPlayerAppearance();
      this.showSystemToast(
        `강화 성공! ${equippedItem.name}${unlockedEffectLabel ? ` · ${unlockedEffectLabel}` : ""}`,
        "#fff1a8"
      );
      this.refreshUi(true);
      return true;
    }

    applyFinalLegendaryEffect(item) {
      item.finalLegendaryEffect = {
        weapon: "flameWeapon",
        shoes: "wingedShoes",
        accessory: "empoweredSplash",
        armor: "physicalGuard",
        helmet: "physicalGuard",
      }[item.type] || null;
    }

    getFinalLegendaryEffectLabel(item) {
      return {
        flameWeapon: "화염검 · 데미지 3배",
        wingedShoes: "천공의 날개 · 이동속도 2배",
        empoweredSplash: "뇌전 폭발 · 스플래시 120%",
        physicalGuard: "전설 수호 · 물리피해 10% 감소",
        infernoWeapon: "불의 권능 · 0.1초마다 대상 최대 체력 0.1% 연소",
        tidalHelmet: "물의 권능 · 공격거리 4배",
        titanArmor: "대지의 권능 · 방어력 힘 × 100",
        tempestShoes: "바람의 권능 · 이동속도 추가 4배",
      }[item?.finalLegendaryEffect] || "";
    }

    findUpgradeableEquipmentSlot(nextItem) {
      if (nextItem.isSupremeBossDrop) {
        return this.playerState.equippedItems[nextItem.type] ? nextItem.type : null;
      }
      if (nextItem.type === "accessory") {
        return ["accessory1", "accessory2"].find((slotKey) => {
          return this.playerState.equippedItems[slotKey]?.type === nextItem.type;
        });
      }

      const equippedItem = this.playerState.equippedItems[nextItem.type];
      return this.getNormalizedItemName(equippedItem) === this.getNormalizedItemName(nextItem)
        ? nextItem.type
        : null;
    }

    getUpgradedItemName(item) {
      const baseName = item.name.replace(/\s\+\d+$/, "");
      return item.upgradeLevel > 0 ? `${baseName} +${item.upgradeLevel}` : baseName;
    }

    getNormalizedItemName(item) {
      if (!item) {
        return "";
      }

      return (item.baseName || item.name)
        .replace(/\s\+\d+$/, "")
        .replace(/^(최강|신화|전설|에픽|레어)\s+/, "")
        .trim();
    }

    getTargetEquipmentSlot(item) {
      if (item.type !== "accessory") {
        return item.type;
      }

      if (!this.playerState.equippedItems.accessory1) {
        return "accessory1";
      }

      if (!this.playerState.equippedItems.accessory2) {
        return "accessory2";
      }

      return "accessory1";
    }

    renderInventory() {
      const equippedElement = document.getElementById("equipment-slots");
      const inventoryElement = document.getElementById("inventory-list");
      if (!equippedElement || !inventoryElement) {
        return;
      }

      equippedElement.innerHTML = "";
      const equippedFragment = document.createDocumentFragment();
      this.getEquipmentSlots().forEach((slot) => {
        const item = this.playerState.equippedItems[slot.key];
        const row = document.createElement("div");
        row.className = "equipment-slot";

        const icon = document.createElement("div");
        icon.className = `item-icon ${item ? this.getItemIconClass(item, slot.key) : slot.icon}`;

        const body = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = item ? item.name : `${slot.label} 비어있음`;
        const stats = document.createElement("span");
        const effectLabel = item?.type === "accessory"
          ? `강화 성공 25% · 동일 타입 +30%${item.upgradeLevel >= config.equipment.accessoryEmpoweredLevel ? " | 화염 스플래시 +20%" : ""}`
          : "강화 성공 25% · 동일 장비 +30%";
        const finalEffectLabel = this.getFinalLegendaryEffectLabel(item);
        stats.textContent = item
          ? `${this.getItemTypeLabel(item)} ${effectLabel}${finalEffectLabel ? ` | ${finalEffectLabel}` : ""} | ${this.formatItemStats(item)}`
          : "더블클릭 장착";

        body.append(title, stats);
        row.append(icon, body);
        equippedFragment.appendChild(row);
      });
      equippedElement.appendChild(equippedFragment);

      inventoryElement.innerHTML = "";
      if (this.playerState.inventory.length === 0) {
        const empty = document.createElement("div");
        empty.className = "inventory-empty";
        empty.textContent = "획득한 장비 없음";
        inventoryElement.appendChild(empty);
        return;
      }

      const inventoryFragment = document.createDocumentFragment();
      this.playerState.inventory.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "inventory-item";
        row.title = "더블클릭 장착 · 동일 장비 강화는 성공률 25%, 실패 시 재료 소멸";
        row.ondblclick = () => this.equipItem(index);

        const icon = document.createElement("div");
        icon.className = `item-icon ${this.getItemIconClass(item)}`;

        const body = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;
        const stats = document.createElement("span");
        const sourceLabel = item.isSupremeBossDrop
          ? `${item.elementLabel} 최강 보스 · 강화 성공 100% · 전용 권능 재료`
          : item.isFinalBossDrop
          ? "최강 · 강화 성공 100% · 능력치 150% 흡수"
          : item.isBossDrop
            ? "보스 장비 · 강화 120%"
            : `STAGE ${item.acquiredStage || 1}`;
        stats.textContent = `${this.getItemTypeLabel(item)} | ${sourceLabel} | LV${item.level} | ${this.formatItemStats(item)}`;

        body.append(name, stats);
        row.append(icon, body);
        inventoryFragment.appendChild(row);
      });
      inventoryElement.appendChild(inventoryFragment);
    }

    getItemIconClass(item, slotKey = "") {
      if (slotKey === "accessory2") {
        return "accessory2";
      }

      return item.type;
    }

    getItemTypeLabel(item) {
      return {
        weapon: "무기",
        shoes: "신발",
        armor: "갑옷",
        helmet: "투구",
        accessory: "악세사리",
      }[item.type] || "장비";
    }

    formatItemStats(item) {
      const labels = {
        damage: "데미지",
        strength: "힘",
        dexterity: "덱스",
        knowledge: "지식",
        defense: "방어",
      };

      const formattedStats = Object.entries(item.stats)
        .map(([key, value]) => `${labels[key]} +${value}`)
        .join(", ");
      return formattedStats || "전용 권능 재료";
    }

    showLootToast(item) {
      this.showSystemToast(`자동 습득: ${item.name}`, "#ffe2ab");
    }

    showSystemToast(message, color) {
      const toast = this.add.text(640, 604, message, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "15px",
        color,
        fontStyle: "800",
        stroke: "#1a1a1b",
        strokeThickness: 4,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1300);

      this.tweens.add({
        targets: toast,
        y: 570,
        alpha: 0,
        duration: 900,
        ease: "Cubic.easeOut",
        onComplete: () => toast.destroy(),
      });
    }

    getSupremeBossProfile(type) {
      return {
        fire: {
          label: "불의",
          name: "홍련의 군주",
          tint: 0xff4b22,
          labelColor: "#ffb08d",
          hpColor: 0xff542f,
          effect: "스플래시",
          dropType: "weapon",
          dropName: "홍련의 심장검",
          legendaryEffect: "infernoWeapon",
        },
        water: {
          label: "물의",
          name: "심해의 군주",
          tint: 0x399eea,
          labelColor: "#9fddff",
          hpColor: 0x45b6ff,
          effect: "지속 피해",
          dropType: "helmet",
          dropName: "심해의 왕관",
          legendaryEffect: "tidalHelmet",
        },
        earth: {
          label: "대지의",
          name: "태고의 거신",
          tint: 0xc49a42,
          labelColor: "#ffe0a0",
          hpColor: 0xb8903f,
          effect: "절대 방어",
          dropType: "armor",
          dropName: "태고의 대지갑",
          legendaryEffect: "titanArmor",
        },
        wind: {
          label: "바람의",
          name: "폭풍의 군주",
          tint: 0x55d6a4,
          labelColor: "#a9ffdf",
          hpColor: 0x55d6a4,
          effect: "고속 회복",
          dropType: "shoes",
          dropName: "폭풍걸음 장화",
          legendaryEffect: "tempestShoes",
        },
      }[type];
    }

    summonSpecialBoss(type) {
      if (this.gameOver || this.stageCleared || this.bossSpawned) {
        return;
      }
      if (type === "awakening" &&
          (!this.playerState.isGladiatorSecondJob || this.playerState.isAwakened)) {
        return;
      }

      const profile = type === "awakening"
        ? {
            name: "각성의 심판자",
            labelColor: "#e1adff",
            hpColor: 0xb35cff,
            tint: 0xb864ee,
            effect: "각성 시험",
          }
        : this.getSupremeBossProfile(type);
      if (!profile) {
        return;
      }

      this.monsterSpawner?.remove(false);
      this.waveEnded = true;
      this.removeActiveEnemies();

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(230, 280);
      const spawnX = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 120, config.world.width - 120);
      const spawnY = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 120, config.world.height - 120);
      const level = Math.max(this.getStageMinimumMonsterLevel(), this.playerState.level + 2);
      const maxHp = type === "awakening"
        ? config.player.promotion.awakening.challengeBossHp
        : config.supremeBoss.maxHp;
      const boss = this.physics.add.sprite(spawnX, spawnY, "boss-idle");
      boss.setScale(type === "awakening" ? 2.45 : 2.8);
      boss.setTint(profile.tint);
      boss.setDepth(22);
      boss.setCollideWorldBounds(true);
      boss.setData("isBoss", true);
      boss.setData("isFinalBoss", false);
      boss.setData("specialBossType", type);
      boss.setData("bossProfile", profile);
      boss.setData("level", level);
      boss.setData("hp", maxHp);
      boss.setData("maxHp", maxHp);
      boss.setData("speed", type === "wind" ? 105 : 70);
      boss.setData("attackRange", config.monsters.attackRangeMax + 100);
      boss.setData("defenseMultiplier", type === "earth" ? config.supremeBoss.earthDefenseMultiplier : 1);
      boss.setData("nextShotAt", this.time.now + 700);
      boss.setData("nextHealAt", this.time.now + config.supremeBoss.windHealInterval);

      const hpBar = this.add.graphics().setDepth(34);
      const levelText = this.add.text(
        boss.x,
        boss.y - 82,
        `${profile.label || ""} ${profile.name} · ${profile.effect} · HP ${maxHp.toLocaleString("ko-KR")}`,
        {
          fontFamily: "Plus Jakarta Sans, Segoe UI",
          fontSize: "14px",
          color: profile.labelColor,
          stroke: "#1a1a1b",
          strokeThickness: 4,
          fontStyle: "800",
        }
      ).setOrigin(0.5).setDepth(35);
      boss.setData("hpBar", hpBar);
      boss.setData("levelText", levelText);
      boss.setData("nameLabel", `${profile.label || ""} ${profile.name} · ${profile.effect}`.trim());

      this.monsters.add(boss);
      this.bossMonster = boss;
      this.bossSpawned = true;
      this.activeSpecialBossType = type;
      this.showSystemToast(
        `${profile.label || ""} ${profile.name} 등장 · HP ${maxHp.toLocaleString("ko-KR")}`.trim(),
        profile.labelColor
      );
      this.refreshUi();
      this.updateFinalBossButton();
    }

    createSupremeBossDrop(type, level) {
      const profile = this.getSupremeBossProfile(type);
      return {
        id: `${Date.now()}-${Phaser.Math.Between(1000, 9999)}`,
        name: `레전더리 ${profile.dropName}`,
        baseName: profile.dropName,
        upgradeLevel: 0,
        type: profile.dropType,
        level,
        rarity: "레전더리",
        isBossDrop: true,
        isSupremeBossDrop: true,
        supremeLegendaryEffect: profile.legendaryEffect,
        elementLabel: profile.label,
        acquiredStage: this.stageNumber,
        stats: {},
        baseStats: {},
      };
    }

    spawnBoss(isFinalBoss = false) {
      if (this.bossSpawned || this.stageCleared) {
        return;
      }

      if (this.gameOver) {
        return;
      }

      // 일반 웨이브를 끝내고 보스전만 남기기 위해 기존 적을 정리한다.
      this.removeActiveEnemies();

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(230, 280);
      const spawnX = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 120, config.world.width - 120);
      const spawnY = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 120, config.world.height - 120);
      const bossLevel = Math.max(this.getStageMinimumMonsterLevel(), this.playerState.level + 2);
      const bossProfile = this.getBossProfile(bossLevel);
      const bossBaseHp = leveling.getMonsterMaxHp(bossLevel);
      const awakenedStats = config.monsters.awakened;
      const awakeningHpMultiplier = this.playerState.isAwakened ? awakenedStats.hpMultiplier : 1;
      const milestoneHpMultiplier = this.isMilestoneBossStage()
        ? config.stage.milestoneBossHpMultiplier
        : 1;
      const finalHpMultiplier = isFinalBoss ? config.stage.finalBossHpMultiplier : 1;
      const bossMaxHp = Math.max(
        220,
        Math.round(
          bossBaseHp *
            config.monsters.bossHpMultiplier *
            bossProfile.hpMultiplier *
            milestoneHpMultiplier *
            finalHpMultiplier *
            this.getStageScale(config.stage.monsterHpMultiplierPerStage) *
            awakeningHpMultiplier
        )
      );

      const boss = this.physics.add.sprite(spawnX, spawnY, "boss-idle");
      boss.setScale(
        config.monsters.bossScale * bossProfile.scale *
          (isFinalBoss ? config.stage.finalBossScaleMultiplier : 1)
          * (this.playerState.isAwakened ? awakenedStats.scaleMultiplier : 1)
      );
      boss.setTint(isFinalBoss ? 0x8f1028 : bossProfile.tint);
      boss.setDepth(22);
      boss.setCollideWorldBounds(true);
      boss.setData("isBoss", true);
      boss.setData("isFinalBoss", isFinalBoss);
      boss.setData("bossProfile", bossProfile);
      boss.setData("level", bossLevel);
      boss.setData("hp", bossMaxHp);
      boss.setData("maxHp", bossMaxHp);
      boss.setData(
        "speed",
        Math.round(
          config.monsters.speedMax *
            config.monsters.bossSpeedMultiplier *
            bossProfile.speedMultiplier *
            this.getStageScale(config.stage.monsterSpeedMultiplierPerStage) *
            (this.playerState.isAwakened ? awakenedStats.speedMultiplier : 1)
        )
      );
      boss.setData("attackRange", config.monsters.attackRangeMax + 70);
      boss.setData(
        "defenseMultiplier",
        (leveling.getMonsterDefenseMultiplier(bossLevel) +
          bossProfile.defenseBonus +
          (this.stageNumber - 1) * config.stage.monsterDefenseBonusPerStage) *
          (this.playerState.isAwakened ? awakenedStats.defenseMultiplier : 1)
      );
      boss.setData("nextShotAt", this.time.now + 900);

      const hpBar = this.add.graphics().setDepth(34);
      const bossLabel = isFinalBoss
        ? `최종 보스 ${bossProfile.name}`
        : this.isMilestoneBossStage()
          ? `폭주 ${bossProfile.name}`
          : bossProfile.name;
      const levelText = this.add.text(boss.x, boss.y - 72, `${bossLabel} LV:${bossLevel}`, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "13px",
        color: bossProfile.labelColor,
        stroke: "#1a1a1b",
        strokeThickness: 3,
        fontStyle: "700",
      }).setOrigin(0.5).setDepth(35);

      boss.setData("hpBar", hpBar);
      boss.setData("levelText", levelText);
      boss.setData("nameLabel", `${bossLabel} LV:${bossLevel}`);

      this.monsters.add(boss);
      this.bossMonster = boss;
      this.bossSpawned = true;
      this.finalBossActive = isFinalBoss;
      this.refreshUi();
      this.updateFinalBossButton();
    }

    getBossProfile(level) {
      if (level >= 15) {
        return {
          name: "차원의 수호자",
          tint: 0xff7a3d,
          labelColor: "#ffb38f",
          hpColor: 0xff6d2d,
          hpMultiplier: 2.4,
          defenseBonus: 3.4,
          speedMultiplier: 1.16,
          scale: 1.22,
        };
      }

      if (level >= 10) {
        return {
          name: "불꽃 수호자",
          tint: 0xffb14a,
          labelColor: "#ffdf8a",
          hpColor: 0xff9a3d,
          hpMultiplier: 1.75,
          defenseBonus: 2.4,
          speedMultiplier: 1.08,
          scale: 1.12,
        };
      }

      if (level >= 5) {
        return {
          name: "번개 수호자",
          tint: 0x94d6ff,
          labelColor: "#b8d7ff",
          hpColor: 0x79d0ff,
          hpMultiplier: 1.28,
          defenseBonus: 1.8,
          speedMultiplier: 1,
          scale: 1.06,
        };
      }

      return {
        name: "숲의 수호자",
        tint: 0xffffff,
        labelColor: "#ffe2ab",
        hpColor: 0xffbf00,
        hpMultiplier: 1,
        defenseBonus: 1.2,
        speedMultiplier: 0.95,
        scale: 1,
      };
    }

    updatePlayerMovement(time) {
      if (this.gameOver || this.stageCleared) {
        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        return;
      }

      // 입력 -> 속도 계산 -> 방향/애니메이션 반영 순서로 진행된다.
      const sprinting = this.wasd.SHIFT.isDown;
      const demonMoveMultiplier = time < this.demonModeUntil
        ? config.player.promotion.demonModeMoveSpeedMultiplier
        : 1;
      const promotionMoveMultiplier = this.playerState.isGladiator
        ? config.player.promotion.moveSpeedMultiplier
        : 1;
      const legendaryMoveMultiplier = this.activeLegendaryEffects.wingedShoes
        ? config.equipment.finalShoesMoveSpeedMultiplier
        : 1;
      const tempestMoveMultiplier = this.activeLegendaryEffects.tempestShoes
        ? config.equipment.tempestMoveSpeedMultiplier
        : 1;
      const speed = config.player.speed * promotionMoveMultiplier * legendaryMoveMultiplier * tempestMoveMultiplier *
        (sprinting ? 1.4 : 1) * demonMoveMultiplier;
      let velocityX = 0;
      let velocityY = 0;

      if (this.cursors.left.isDown || this.wasd.A.isDown) {
        velocityX -= speed;
      }
      if (this.cursors.right.isDown || this.wasd.D.isDown) {
        velocityX += speed;
      }
      if (this.cursors.up.isDown || this.wasd.W.isDown) {
        velocityY -= speed;
      }
      if (this.cursors.down.isDown || this.wasd.S.isDown) {
        velocityY += speed;
      }

      const moving = velocityX !== 0 || velocityY !== 0;
      this.player.setVelocity(velocityX, velocityY);
      this.player.body.velocity.normalize().scale(speed);

      if (velocityX < 0) {
        this.player.setFlipX(true);
      } else if (velocityX > 0) {
        this.player.setFlipX(false);
      }

      if (time < this.playerAttackLockedUntil) {
        // 공격 모션 중에는 이동 애니메이션으로 덮어쓰지 않는다.
        return;
      }

      if (moving) {
        this.player.anims.play(this.getPlayerRunAnimationKey(), true);
      } else {
        this.player.anims.stop();
        const idleTexture = this.getPlayerTextureKey("idle");
        if (this.player.texture.key !== idleTexture) {
          this.player.setTexture(idleTexture);
        }
      }
    }

    updateMonsters(time) {
      if (this.gameOver) {
        return;
      }

      // 모든 몬스터를 순회하며 이동/공격/머리 위 UI를 갱신한다.
      this.monsters.getChildren().forEach((monster) => {
        if (!monster.active) {
          return;
        }

        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
        const desiredRange = monster.getData("attackRange");

        // 플레이어 방향으로 속도 벡터를 자동 계산해 이동시킨다.
        this.physics.moveToObject(monster, this.player, monster.getData("speed"));

        if (monster.body.velocity.x < 0) {
          monster.setFlipX(true);
        } else if (monster.body.velocity.x > 0) {
          monster.setFlipX(false);
        }

        if (this.canMonsterUseRangedAttack(monster, distance, desiredRange, time)) {
          this.fireMonsterProjectile(monster);
          monster.setData(
            "nextShotAt",
            time + Phaser.Math.Between(config.monsters.attackIntervalMin, config.monsters.attackIntervalMax)
          );
        }

        this.updateSpecialBossAbility(monster, time);

        this.updateMonsterAnimation(monster, time);

        this.drawMonsterHud(monster);
      });
    }

    updateSpecialBossAbility(monster, time) {
      if (monster.getData("specialBossType") !== "wind" || time < monster.getData("nextHealAt")) {
        return;
      }
      const maxHp = monster.getData("maxHp");
      const hp = monster.getData("hp");
      monster.setData("hp", Math.min(maxHp, hp + maxHp * config.supremeBoss.windHealMaxHpRatio));
      monster.setData("nextHealAt", time + config.supremeBoss.windHealInterval);
      monster.setData("lastHudHpRatio", null);
      this.playBossRecoveryEffect(monster);
    }

    playBossRecoveryEffect(monster) {
      const ring = this.add.circle(monster.x, monster.y, 28).setDepth(45);
      ring.setStrokeStyle(5, 0x7dffbe, 0.9);
      this.tweens.add({
        targets: ring,
        scaleX: 3,
        scaleY: 3,
        alpha: 0,
        duration: 420,
        onComplete: () => ring.destroy(),
      });
    }

    canMonsterUseRangedAttack(monster, distance, desiredRange, time) {
      if (distance > desiredRange || time < monster.getData("nextShotAt")) {
        return false;
      }

      if (monster.getData("isBoss")) {
        return true;
      }

      if (monster.getData("level") < 3) {
        return false;
      }

      return Phaser.Math.Between(1, 100) <= 38;
    }

    updateMonsterAnimation(monster, time) {
      // 정지/이동/공격 직후 상태에 따라 다른 텍스처를 보여준다.
      const moving = monster.body.velocity.length() > 4;
      const attackLockedUntil = monster.getData("attackLockedUntil") || 0;
      const isBoss = monster.getData("isBoss");
      const idleKey = isBoss ? "boss-idle" : `monster-${monster.getData("variant")}-idle`;
      const attackKey = isBoss ? "boss-attack" : `monster-${monster.getData("variant")}-attack`;
      const runKey = isBoss ? "boss-run" : `monster-${monster.getData("variant")}-run`;

      if (time < attackLockedUntil) {
        monster.anims.stop();
        if (monster.texture.key !== attackKey) {
          monster.setTexture(attackKey);
        }
        return;
      }

      if (moving) {
        monster.anims.play(runKey, true);
      } else {
        monster.anims.stop();
        if (monster.texture.key !== idleKey) {
          monster.setTexture(idleKey);
        }
      }
    }

    drawMonsterHud(monster) {
      // 몬스터마다 따로 생성해 둔 체력바/레벨 텍스트 위치를 갱신한다.
      const hpBar = monster.getData("hpBar");
      const levelText = monster.getData("levelText");
      const hp = monster.getData("hp");
      const maxHp = monster.getData("maxHp");
      const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
      const isBoss = monster.getData("isBoss");
      const bossProfile = monster.getData("bossProfile");
      const level = monster.getData("level");
      const barWidth = isBoss ? 92 : 42 + Math.min(level, 4) * 4;
      const barY = isBoss ? -58 - (monster.scaleY - 1) * 24 : -36 - (monster.scaleY - 1) * 20;
      const textY = isBoss ? barY - 16 : -48 - (monster.scaleY - 1) * 20;
      const barHeight = isBoss ? 8 : 6;

      // 위치는 Graphics 자체를 옮기고, 체력이 변할 때만 도형을 다시 그린다.
      hpBar.setPosition(monster.x, monster.y);
      if (monster.getData("lastHudHpRatio") !== ratio) {
        hpBar.clear();
        hpBar.fillStyle(0x1a1a1b, 0.95);
        hpBar.fillRoundedRect(-barWidth / 2, barY, barWidth, barHeight, 3);
        hpBar.fillStyle(isBoss ? bossProfile?.hpColor || 0xffbf00 : 0xff6d62, 1);
        hpBar.fillRoundedRect(-barWidth / 2, barY, barWidth * ratio, barHeight, 3);
        hpBar.lineStyle(1, 0xffe2ab, 0.5);
        hpBar.strokeRoundedRect(-barWidth / 2, barY, barWidth, barHeight, 3);
        monster.setData("lastHudHpRatio", ratio);
        levelText.setText(
          `${monster.getData("nameLabel") || `LV${level}`} | HP ${Math.ceil(hp).toLocaleString("ko-KR")} / ${Math.ceil(maxHp).toLocaleString("ko-KR")}`
        );
      }
      levelText.setPosition(monster.x, monster.y + textY);
    }

    drawPlayerHud() {
      // 플레이어가 움직일 때 머리 위 레벨 라벨도 같이 따라오게 한다.
      if (!this.playerLevelText?.active) {
        return;
      }

      if (this.lastPlayerLevelLabel !== this.playerState.level) {
        this.lastPlayerLevelLabel = this.playerState.level;
        this.playerLevelText.setText(`LV:${this.playerState.level}`);
      }
      this.playerLevelText.setPosition(this.player.x, this.player.y - 52);
    }

    updateStatusCounter(time) {
      if (time - this.lastStatusCounterRefreshAt < 200) {
        return;
      }
      this.lastStatusCounterRefreshAt = time;
      hudSystem.refreshStatusCounter(this);
    }

    fireMonsterProjectile(monster) {
      // 투사체 생성 -> 속도 부여 -> group 등록 순서.
      const projectile = this.physics.add.image(monster.x, monster.y - 4, "enemy-shot");
      const isBoss = monster.getData("isBoss");
      const stageDamageMultiplier = this.getStageScale(config.stage.monsterDamageMultiplierPerStage);
      const awakenedStats = config.monsters.awakened;
      const awakeningDamageMultiplier = this.playerState.isAwakened ? awakenedStats.damageMultiplier : 1;
      const milestoneDamageMultiplier = isBoss && this.isMilestoneBossStage()
        ? config.stage.milestoneBossDamageMultiplier
        : 1;
      const finalBossDamageMultiplier = monster.getData("isFinalBoss")
        ? config.stage.finalBossDamageMultiplier
        : 1;
      projectile.setDepth(24);
      projectile.setScale(isBoss ? 1.4 : 1);
      let projectileDamage = isBoss
          ? Math.round(
              (config.monsters.projectileDamage + monster.getData("level") * 2) *
                config.monsters.bossProjectileDamageMultiplier *
                milestoneDamageMultiplier *
                finalBossDamageMultiplier *
                stageDamageMultiplier *
                awakeningDamageMultiplier
            )
          : Math.round(
              (config.monsters.projectileDamage + monster.getData("level") * 2) *
                stageDamageMultiplier *
                awakeningDamageMultiplier
            );
      if (monster.getData("specialBossType")) {
        projectileDamage = Math.max(
          projectileDamage,
          Math.round(
            this.playerState.defense +
              this.playerState.maxHp * config.supremeBoss.projectileMaxHpDamageRatio
          )
        );
      } else if (this.playerState.isAwakened) {
        const maxHpDamageRatio = isBoss
          ? awakenedStats.bossProjectileMaxHpDamageRatio
          : awakenedStats.projectileMaxHpDamageRatio;
        projectileDamage = Math.max(
          projectileDamage,
          Math.round(this.playerState.defense + this.playerState.maxHp * maxHpDamageRatio)
        );
      }
      projectile.setData("damage", projectileDamage);
      projectile.setData("spawnedAt", this.time.now);
      projectile.setData("speed", config.monsters.projectileSpeed);
      projectile.setData("specialBossType", monster.getData("specialBossType") || null);
      monster.setData("attackLockedUntil", this.time.now + 180);
      this.physics.moveToObject(projectile, this.player, config.monsters.projectileSpeed);
      this.enemyProjectiles.add(projectile);

      // 공격 피드백으로 몬스터를 짧게 눌렀다가 되돌린다.
      this.tweens.add({
        targets: monster,
        scaleX: 1.08,
        scaleY: 0.92,
        yoyo: true,
        duration: 90,
      });
    }

    handleProjectileHit(player, projectile) {
      // overlap 콜백. 이미 제거된 투사체면 무시한다.
      if (this.gameOver || !projectile.active) {
        return;
      }

      // 방어력만큼 차감하되 최소 피해는 1 보장.
      const incomingDamage = projectile.getData("damage");
      const specialBossType = projectile.getData("specialBossType");
      const defenseReducedDamage = Math.max(1, incomingDamage - this.playerState.defense);
      const reducedDamage = defenseReducedDamage * (
        this.activeLegendaryEffects.physicalGuard
          ? 1 - config.equipment.finalArmorPhysicalDamageReduction
          : 1
      );
      this.playerState.hp = Math.max(0, this.playerState.hp - reducedDamage);
      if (specialBossType === "fire") {
        this.playerState.hp = Math.max(0, this.playerState.hp - reducedDamage * 0.5);
        this.playElementalHitEffect(player.x, player.y, 0xff542f, "화염 스플래시");
      } else if (specialBossType === "water") {
        this.waterDotUntil = this.time.now + config.supremeBoss.waterDotDuration;
        this.nextWaterDotAt = this.time.now + config.supremeBoss.waterDotInterval;
        this.playElementalHitEffect(player.x, player.y, 0x45b6ff, "침수");
      }
      projectile.destroy();
      this.refreshUi();

      if (this.playerState.hp <= 0) {
        this.showGameOver();
      }
    }

    playElementalHitEffect(x, y, color, label) {
      const blast = this.add.circle(x, y, 22, color, 0.7).setDepth(50);
      const text = this.add.text(x, y - 54, label, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "800",
        stroke: "#1a1a1b",
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(51);
      this.tweens.add({ targets: blast, scale: 4, alpha: 0, duration: 350, onComplete: () => blast.destroy() });
      this.tweens.add({ targets: text, y: y - 90, alpha: 0, duration: 650, onComplete: () => text.destroy() });
    }

    updatePlayerStatusEffects(time) {
      if (time < this.waterDotUntil && time >= this.nextWaterDotAt && !this.gameOver) {
        const damage = Math.max(1, this.playerState.maxHp * config.supremeBoss.waterDotDamageRatio);
        this.playerState.hp = Math.max(0, this.playerState.hp - damage);
        this.nextWaterDotAt = time + config.supremeBoss.waterDotInterval;
        this.playElementalHitEffect(this.player.x, this.player.y, 0x298fda, "지속 피해");
        this.refreshUi();
        if (this.playerState.hp <= 0) {
          this.showGameOver();
        }
      }
    }

    handleAutoAttack(time) {
      if (this.gameOver) {
        return;
      }

      // 쿨타임이 끝났고 사거리 내 대상이 있을 때만 자동 공격한다.
      if (time < this.attackCooldown) {
        return;
      }

      const target = this.findNearestMonster();
      if (!target) {
        return;
      }

      // 공속이 올라갈수록 실제 공격 주기가 짧아진다.
      const minimumAttackCooldown = this.playerState.isAwakened
        ? config.player.promotion.awakening.minimumAttackCooldown
        : this.playerState.isGladiator ? 20 : 120;
      this.attackCooldown = time + Math.max(
        minimumAttackCooldown,
        config.player.attackCooldownBase / this.getEffectiveAttackRateStage(time)
      );
      this.playerAttackLockedUntil = time + 140;

      this.playMeleeAttack(target);
      const criticalHit = this.isGladiatorCriticalHit();
      if (criticalHit) {
        this.playCriticalImpact(target);
      } else if (this.hasHeavyImpactUnlocked()) {
        this.playHeavyImpact(target, time);
      }
      if (this.playerState.isGladiator) {
        const attackDamage = this.playerState.damage * (
          criticalHit ? config.player.promotion.criticalDamageMultiplier : 1
        );
        if (this.playerState.isAwakened) {
          this.handleAwakenedBasicAttack(target);
        }
        this.handleGladiatorBasicAttack(target, attackDamage);
        return;
      }

      if (this.hasEmpoweredAccessory()) {
        this.handleEmpoweredBasicAttack(target);
        return;
      }

      this.damageMonster(target, this.playerState.damage);
    }

    handleAwakenedBasicAttack(target) {
      const awakening = config.player.promotion.awakening;
      const hpRatio = Math.min(
        awakening.maxMonsterHpDamageRatio,
        this.playerState.strength * awakening.monsterHpDamagePercentPerStrength / 100
      );
      const proportionalDamage = target.getData("maxHp") * hpRatio;
      this.playBleedingImpact(target);
      this.damageMonster(target, proportionalDamage, { ignoreDefense: true });
    }

    playBleedingImpact(target) {
      if (this.time.now - this.lastBleedingImpactAt < config.player.promotion.awakening.bleedingFeedbackCooldown) {
        return;
      }
      this.lastBleedingImpactAt = this.time.now;
      const x = target.x;
      const y = target.y - 8;
      for (let index = 0; index < 9; index += 1) {
        const angle = Phaser.Math.FloatBetween(-Math.PI, 0);
        const blood = this.add.circle(x, y, Phaser.Math.Between(3, 7), 0xb4142c, 0.95).setDepth(54);
        this.tweens.add({
          targets: blood,
          x: x + Math.cos(angle) * Phaser.Math.Between(28, 70),
          y: y + Math.sin(angle) * Phaser.Math.Between(28, 70) + 32,
          alpha: 0,
          duration: Phaser.Math.Between(280, 520),
          onComplete: () => blood.destroy(),
        });
      }
      const bleedText = this.add.text(x, y - 42, "출혈", {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "20px",
        color: "#ff5a6f",
        fontStyle: "900",
        stroke: "#39030b",
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(55);
      this.tweens.add({ targets: bleedText, y: y - 82, alpha: 0, duration: 560, onComplete: () => bleedText.destroy() });
    }

    updateInfernoWeapon(time) {
      if (!this.activeLegendaryEffects.infernoWeapon ||
          time - this.lastInfernoBurnAt < config.equipment.infernoBurnInterval) {
        return;
      }
      const target = this.findNearestActiveMonster();
      if (!target) {
        return;
      }
      this.lastInfernoBurnAt = time;
      this.damageMonster(
        target,
        target.getData("maxHp") * config.equipment.infernoBurnMaxHpRatio,
        { ignoreDefense: true }
      );
      const ember = this.add.circle(target.x, target.y - 8, 7, 0xff5a20, 0.85).setDepth(47);
      this.tweens.add({ targets: ember, y: target.y - 48, scale: 0.2, alpha: 0, duration: 180, onComplete: () => ember.destroy() });
    }

    findNearestActiveMonster() {
      let nearest = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      this.monsters.getChildren().forEach((monster) => {
        if (!monster.active) return;
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
        if (distance < nearestDistance) {
          nearest = monster;
          nearestDistance = distance;
        }
      });
      return nearest;
    }

    hasEmpoweredAccessory() {
      return ["accessory1", "accessory2"].some((slotKey) => {
        const item = this.playerState.equippedItems[slotKey];
        return item?.type === "accessory" && item.upgradeLevel >= config.equipment.accessoryEmpoweredLevel;
      });
    }

    handleEmpoweredBasicAttack(target) {
      const impactX = target.x;
      const impactY = target.y;
      const damage = this.playerState.damage * config.equipment.accessoryBasicAttackDamageMultiplier;
      const splashTargets = this.monsters.getChildren().filter((monster) => {
        return monster.active && Phaser.Math.Distance.Between(impactX, impactY, monster.x, monster.y) <= config.equipment.accessorySplashRadius;
      });

      this.playFireSplashEffect(impactX, impactY);
      splashTargets.forEach((monster) => this.damageMonster(monster, damage));
    }

    handleGladiatorBasicAttack(target, attackDamage) {
      const chainedTargets = [];
      const visited = new Set([target]);
      const activeMonsters = this.monsters.getChildren().filter((monster) => monster.active);
      let current = target;

      while (chainedTargets.length < 5) {
        let next = null;
        let nearestDistance = config.player.promotion.chainLightningRadius;
        activeMonsters.forEach((monster) => {
          if (visited.has(monster)) {
            return;
          }
          const distance = Phaser.Math.Distance.Between(current.x, current.y, monster.x, monster.y);
          if (distance <= nearestDistance) {
            next = monster;
            nearestDistance = distance;
          }
        });

        if (!next) {
          break;
        }

        visited.add(next);
        chainedTargets.push(next);
        current = next;
      }

      this.playChainLightningEffect([target, ...chainedTargets]);
      this.damageMonster(target, attackDamage);
      const splashDamageRatio = this.activeLegendaryEffects.empoweredSplash
        ? config.equipment.finalAccessorySplashDamageRatio
        : config.player.promotion.chainLightningDamageRatio;
      chainedTargets.forEach((monster) => {
        this.damageMonster(monster, attackDamage * splashDamageRatio);
      });
    }

    handleSkillCast(time) {
      if (this.gameOver) {
        return;
      }

      if (!Phaser.Input.Keyboard.JustDown(this.skillKey)) {
        return;
      }

      if (time < this.skillCooldownUntil || this.stageCleared) {
        return;
      }

      const skillProfile = this.getSkillProfile();
      this.skillCooldownUntil = time + (skillProfile.cooldown || config.stage.skillCooldown);

      if (this.playerState.isGladiator) {
        this.demonModeUntil = time + config.player.promotion.demonModeDuration;
        if (this.playerState.isGladiatorSecondJob) {
          this.guaranteedCriticalUntil = time + config.player.promotion.guaranteedCriticalDuration;
        }
        this.playSkillExplosion(skillProfile);
        this.refreshUi();
        return;
      }

      const skillDamage = Math.round(
        (this.playerState.damage + this.playerState.magicDamage + this.playerState.strength * 4) *
          Math.pow(1.42, this.playerState.level + 1) *
          skillProfile.multiplier
      );

      if (skillProfile.attackSpeedBuff) {
        this.attackSpeedBuffUntil = time + 2000;
      }

      this.playSkillExplosion(skillProfile);

      this.monsters.getChildren().forEach((monster) => {
        if (!monster.active) {
          return;
        }
        this.damageMonster(monster, skillDamage);
      });

      this.refreshUi();
    }

    findNearestMonster() {
      // 사거리 안의 적 중 가장 가까운 한 마리만 반환한다.
      let nearest = null;
      let nearestDistance = this.getPlayerAttackRange();

      this.monsters.getChildren().forEach((monster) => {
        if (!monster.active) {
          return;
        }

        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
        if (distance < nearestDistance) {
          nearest = monster;
          nearestDistance = distance;
        }
      });

      return nearest;
    }

    hasHeavyImpactUnlocked() {
      return this.playerState.isGladiator &&
        this.playerState.level >= config.player.promotion.impactRequiredLevel;
    }

    isGladiatorCriticalHit() {
      if (!this.playerState.isGladiator) {
        return false;
      }
      if (this.playerState.isGladiatorSecondJob && this.time.now < this.guaranteedCriticalUntil) {
        return true;
      }
      return Phaser.Math.Between(1, 100) <= config.player.promotion.criticalChance * 100;
    }

    applyHitStop(duration) {
      this.physics.world.pause();
      this.hitStopEvent?.remove(false);
      this.hitStopEvent = this.time.delayedCall(duration, () => {
        this.physics.world.resume();
        this.hitStopEvent = null;
      });
    }

    playHeavyImpact(target, time) {
      if (time - this.lastHeavyImpactAt < config.player.promotion.impactFeedbackCooldown) {
        return;
      }
      this.lastHeavyImpactAt = time;

      const impactX = target.x;
      const impactY = target.y - 6;
      this.cameras.main.shake(75, 0.0045);
      this.applyHitStop(config.player.promotion.impactHitStopDuration);

      const core = this.add.circle(impactX, impactY, 14, 0xffffff, 0.95).setDepth(48);
      const ring = this.add.circle(impactX, impactY, 18).setDepth(47);
      ring.setStrokeStyle(6, 0xffd35c, 1);
      this.tweens.add({
        targets: core,
        scaleX: 2.8,
        scaleY: 2.8,
        alpha: 0,
        duration: 110,
        onComplete: () => core.destroy(),
      });
      this.tweens.add({
        targets: ring,
        scaleX: 3.2,
        scaleY: 3.2,
        alpha: 0,
        duration: 180,
        onComplete: () => ring.destroy(),
      });

      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI * 2 * index) / 6;
        const spark = this.add.rectangle(impactX, impactY, 14, 4, 0xfff1a8, 1)
          .setRotation(angle)
          .setDepth(49);
        this.tweens.add({
          targets: spark,
          x: impactX + Math.cos(angle) * 52,
          y: impactY + Math.sin(angle) * 52,
          scaleX: 0.2,
          alpha: 0,
          duration: 150,
          onComplete: () => spark.destroy(),
        });
      }
    }

    playCriticalImpact(target) {
      if (this.time.now - this.lastCriticalImpactAt < config.player.promotion.impactFeedbackCooldown) {
        return;
      }
      this.lastCriticalImpactAt = this.time.now;
      const impactX = target.x;
      const impactY = target.y - 8;
      this.cameras.main.shake(110, 0.009);
      this.applyHitStop(config.player.promotion.criticalHitStopDuration);

      const flash = this.add.circle(impactX, impactY, 22, 0xffffff, 1).setDepth(52);
      const criticalRing = this.add.circle(impactX, impactY, 26).setDepth(51);
      criticalRing.setStrokeStyle(9, 0xff3d3d, 1);
      const criticalText = this.add.text(impactX, impactY - 54, "크리티컬!", {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "25px",
        color: "#fff1a8",
        fontStyle: "900",
        stroke: "#8f1010",
        strokeThickness: 7,
      }).setOrigin(0.5).setDepth(53);

      this.tweens.add({
        targets: flash,
        scaleX: 4.5,
        scaleY: 4.5,
        alpha: 0,
        duration: 150,
        onComplete: () => flash.destroy(),
      });
      this.tweens.add({
        targets: criticalRing,
        scaleX: 4,
        scaleY: 4,
        alpha: 0,
        duration: 260,
        onComplete: () => criticalRing.destroy(),
      });
      this.tweens.add({
        targets: criticalText,
        y: impactY - 104,
        scaleX: 1.2,
        scaleY: 1.2,
        alpha: 0,
        duration: 620,
        ease: "Cubic.easeOut",
        onComplete: () => criticalText.destroy(),
      });
    }

    playMeleeAttack(target) {
      // 플레이어 방향 전환 + 공격 텍스처 + slash 이펙트를 묶은 연출.
      const facingLeft = target.x < this.player.x;
      this.player.setFlipX(facingLeft);
      if (this.time.now - this.lastMeleeVisualAt < config.player.promotion.meleeFeedbackCooldown) {
        return;
      }
      this.lastMeleeVisualAt = this.time.now;
      this.player.anims.stop();
      this.player.setTexture(this.getPlayerTextureKey("attack"));

      const slash = this.add.image(
        this.player.x + (facingLeft ? -26 : 26),
        this.player.y - 6,
        "slash"
      );
      slash.setDepth(25);
      slash.setFlipX(facingLeft);
      slash.setAngle(facingLeft ? 210 : -25);
      slash.setAlpha(0.94);

      this.tweens.add({
        targets: slash,
        alpha: 0,
        scaleX: 1.2,
        scaleY: 1.05,
        duration: 130,
        onComplete: () => slash.destroy(),
      });

      this.time.delayedCall(120, () => {
        if (!this.player.active) {
          return;
        }
        if (this.player.body.velocity.length() > 0) {
          this.player.anims.play(this.getPlayerRunAnimationKey(), true);
        } else {
          this.player.setTexture(this.getPlayerTextureKey("idle"));
        }
      });
    }

    playChainLightningEffect(targets) {
      if (targets.length < 2 ||
          this.time.now - this.lastChainEffectAt < config.player.promotion.chainFeedbackCooldown) {
        return;
      }
      this.lastChainEffectAt = this.time.now;

      const lightning = this.add.graphics().setDepth(43);
      lightning.lineStyle(7, 0x79d0ff, 0.72);
      lightning.beginPath();
      lightning.moveTo(targets[0].x, targets[0].y - 8);
      targets.slice(1).forEach((target, index) => {
        const jitter = index % 2 === 0 ? 10 : -10;
        lightning.lineTo(target.x + jitter, target.y - 18);
        lightning.lineTo(target.x, target.y - 8);
      });
      lightning.strokePath();
      lightning.lineStyle(3, 0xfffdd0, 1);
      lightning.strokePath();
      this.tweens.add({
        targets: lightning,
        alpha: 0,
        duration: 220,
        onComplete: () => lightning.destroy(),
      });
    }

    playFireSplashEffect(x, y) {
      const core = this.add.circle(x, y, 20, 0xff6d2d, 0.88).setDepth(42);
      const glow = this.add.circle(x, y, 30, 0xffbf00, 0.42).setDepth(41);
      const ring = this.add.circle(x, y, config.equipment.accessorySplashRadius * 0.35).setDepth(43);
      ring.setStrokeStyle(6, 0xff8a2b, 0.95);

      Array.from({ length: 7 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 7;
        const flame = this.add.circle(x, y, 8, index % 2 === 0 ? 0xffbf00 : 0xff4f1f, 0.9).setDepth(44);
        this.tweens.add({
          targets: flame,
          x: x + Math.cos(angle) * config.equipment.accessorySplashRadius * 0.72,
          y: y + Math.sin(angle) * config.equipment.accessorySplashRadius * 0.72 - 16,
          scaleX: 0.25,
          scaleY: 1.8,
          alpha: 0,
          duration: 280,
          ease: "Cubic.easeOut",
          onComplete: () => flame.destroy(),
        });
      });

      this.tweens.add({
        targets: core,
        scaleX: 3.5,
        scaleY: 3.5,
        alpha: 0,
        duration: 260,
        onComplete: () => core.destroy(),
      });
      this.tweens.add({
        targets: glow,
        scaleX: 4,
        scaleY: 4,
        alpha: 0,
        duration: 330,
        onComplete: () => glow.destroy(),
      });
      this.tweens.add({
        targets: ring,
        scaleX: 2.9,
        scaleY: 2.9,
        alpha: 0,
        duration: 320,
        onComplete: () => ring.destroy(),
      });
    }

    playSkillExplosion(skillProfile) {
      const flash = this.add.circle(this.player.x, this.player.y, 24, skillProfile.color, 0.72).setDepth(39);
      const ring = this.add.circle(this.player.x, this.player.y, 30).setDepth(40);
      ring.setStrokeStyle(8, skillProfile.accent, 1);
      const skillText = this.add.text(this.player.x, this.player.y - 84, skillProfile.name, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "24px",
        color: "#fffdd0",
        fontStyle: "800",
        stroke: "#1a1a1b",
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(44);

      this.tweens.add({
        targets: flash,
        scaleX: 16,
        scaleY: 16,
        alpha: 0,
        duration: 360,
        onComplete: () => flash.destroy(),
      });

      this.tweens.add({
        targets: ring,
        scaleX: 18,
        scaleY: 18,
        alpha: 0,
        duration: 460,
        onComplete: () => ring.destroy(),
      });

      this.tweens.add({
        targets: skillText,
        y: this.player.y - 126,
        alpha: 0,
        duration: 720,
        ease: "Cubic.easeOut",
        onComplete: () => skillText.destroy(),
      });

      if (skillProfile.name === "번개") {
        this.monsters.getChildren().forEach((monster) => {
          if (!monster.active) {
            return;
          }
          const bolt = this.add.graphics().setDepth(43);
          bolt.lineStyle(5, 0xfffdd0, 1);
          bolt.lineBetween(monster.x - 10, monster.y - 90, monster.x + 8, monster.y - 34);
          bolt.lineTo(monster.x - 8, monster.y - 14);
          bolt.lineStyle(2, 0x79d0ff, 1);
          bolt.lineBetween(monster.x + 8, monster.y - 34, monster.x + 18, monster.y - 6);
          this.tweens.add({
            targets: bolt,
            alpha: 0,
            duration: 260,
            onComplete: () => bolt.destroy(),
          });
        });
      }

      if (skillProfile.name === "불기둥") {
        this.monsters.getChildren().forEach((monster) => {
          if (!monster.active) {
            return;
          }
          const pillar = this.add.graphics().setDepth(43);
          pillar.fillStyle(0xff6d2d, 0.82);
          pillar.fillRoundedRect(monster.x - 18, monster.y - 72, 36, 86, 16);
          pillar.fillStyle(0xffbf00, 0.92);
          pillar.fillRoundedRect(monster.x - 9, monster.y - 56, 18, 58, 9);
          this.tweens.add({
            targets: pillar,
            scaleY: 1.3,
            alpha: 0,
            duration: 360,
            onComplete: () => pillar.destroy(),
          });
        });
      }
    }

    showGameOver() {
      if (this.gameOver) {
        return;
      }

      this.gameOver = true;
      this.waveEnded = true;
      this.monsterSpawner?.remove(false);
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setTexture(this.getPlayerTextureKey("idle"));
      this.player.setTint(0x6d7480);
      this.promotionAura?.setVisible(false);
      this.removeActiveEnemies();

      const overlay = this.add.container(640, 360).setScrollFactor(0).setDepth(1600);
      const dim = this.add.rectangle(0, 0, 1280, 720, 0x060808, 0.72);
      const panel = this.add.graphics();
      panel.fillStyle(0x1a1a1b, 0.98);
      panel.fillRoundedRect(-220, -138, 440, 276, 14);
      panel.fillStyle(0x1b2b20, 0.98);
      panel.fillRoundedRect(-212, -130, 424, 260, 10);
      panel.lineStyle(2, 0xffe2ab, 0.74);
      panel.strokeRoundedRect(-212, -130, 424, 260, 10);

      const title = this.add.text(0, -82, "끝", {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "54px",
        color: "#ffb3ae",
        fontStyle: "800",
        stroke: "#1a1a1b",
        strokeThickness: 8,
      }).setOrigin(0.5);
      const subtitle = this.add.text(0, -28, `LV ${this.playerState.level}부터 다시 도전`, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "18px",
        color: "#fffdd0",
        fontStyle: "700",
      }).setOrigin(0.5);
      const restartButtonBg = this.add.rectangle(0, 62, 214, 58, 0xffbf00, 1)
        .setStrokeStyle(3, 0x1a1a1b, 1)
        .setInteractive({ useHandCursor: true });
      const restartButton = this.add.text(0, 62, "다시시작 하기", {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "20px",
        color: "#402d00",
        fontStyle: "800",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      const setButtonScale = (scale) => {
        restartButtonBg.setScale(scale);
        restartButton.setScale(scale);
      };
      const restart = () => this.restartFromCurrentLevel();
      restartButtonBg.on("pointerover", () => setButtonScale(1.04));
      restartButtonBg.on("pointerout", () => setButtonScale(1));
      restartButtonBg.on("pointerdown", restart);
      restartButton.on("pointerover", () => setButtonScale(1.04));
      restartButton.on("pointerout", () => setButtonScale(1));
      restartButton.on("pointerdown", restart);

      overlay.add([dim, panel, title, subtitle, restartButtonBg, restartButton]);
      this.gameOverOverlay = overlay;
      this.gameOverRestartBounds = new Phaser.Geom.Rectangle(533, 393, 214, 58);
      this.gameOverPointerHandler = (pointer) => {
        if (!this.gameOver || !this.gameOverRestartBounds?.contains(pointer.x, pointer.y)) {
          return;
        }

        this.restartFromCurrentLevel();
      };
      this.input.on("pointerdown", this.gameOverPointerHandler);
      this.refreshUi();
      this.updateFinalBossButton();
    }

    restartFromCurrentLevel() {
      this.monsterSpawner?.remove(false);
      if (this.gameOverPointerHandler) {
        this.input.off("pointerdown", this.gameOverPointerHandler);
      }
      this.gameOverPointerHandler = null;
      this.gameOverRestartBounds = null;
      this.gameOverOverlay?.destroy();
      this.gameOverOverlay = null;
      this.gameOver = false;
      this.stageClearText?.destroy();
      this.stageClearText = null;
      this.removeActiveEnemies();
      this.recalculatePlayerStats();
      this.playerState.hp = this.playerState.maxHp;
      this.attackCooldown = 0;
      this.playerAttackLockedUntil = 0;
      this.skillCooldownUntil = 0;
      this.attackSpeedBuffUntil = 0;
      this.demonModeUntil = 0;
      this.guaranteedCriticalUntil = 0;
      this.player.setPosition(1200, 1200);
      this.player.setVelocity(0, 0);
      this.player.setActive(true).setVisible(true);
      this.player.anims.stop();
      this.applyPlayerAppearance();
      this.playReviveEffect();
      this.startStage();
      this.startMonsterSpawner();
      this.refreshUi();
    }

    playReviveEffect() {
      const flash = this.add.circle(this.player.x, this.player.y, 28, 0xf2ca50, 0.62).setDepth(45);
      const ring = this.add.circle(this.player.x, this.player.y, 24).setDepth(46);
      ring.setStrokeStyle(6, 0xd3e4fe, 1);
      const reviveText = this.add.text(this.player.x, this.player.y - 72, "부활", {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "26px",
        color: "#fffdd0",
        fontStyle: "800",
        stroke: "#1a1a1b",
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(47);

      this.tweens.add({
        targets: flash,
        scaleX: 4,
        scaleY: 4,
        alpha: 0,
        duration: 360,
        onComplete: () => flash.destroy(),
      });
      this.tweens.add({
        targets: ring,
        scaleX: 4.8,
        scaleY: 4.8,
        alpha: 0,
        duration: 520,
        onComplete: () => ring.destroy(),
      });
      this.tweens.add({
        targets: reviveText,
        y: this.player.y - 118,
        alpha: 0,
        duration: 760,
        ease: "Cubic.easeOut",
        onComplete: () => reviveText.destroy(),
      });
    }

    damageMonster(monster, amount, { ignoreDefense = false } = {}) {
      // 몬스터 레벨 기반 방어 배율을 적용한 뒤 HP를 감소시킨다.
      if (!monster.active) {
        return;
      }

      const defenseMultiplier = monster.getData("defenseMultiplier") || 1;
      const mitigatedDamage = Math.max(0.1, ignoreDefense ? amount : amount / defenseMultiplier);
      const currentHp = monster.getData("hp");
      const dealtDamage = Math.min(currentHp, mitigatedDamage);
      const nextHp = Math.max(0, currentHp - mitigatedDamage);
      monster.setData("hp", nextHp);
      this.showMonsterDamageNumber(monster, dealtDamage, ignoreDefense);
      this.drawMonsterHud(monster);

      if (this.time.now < this.demonModeUntil && dealtDamage > 0) {
        const healedHp = dealtDamage * config.player.promotion.demonModeLifeStealRatio;
        this.playerState.hp = Math.min(this.playerState.maxHp, this.playerState.hp + healedHp);
        if (this.time.now - this.lastCombatHudRefreshAt >= 100) {
          this.lastCombatHudRefreshAt = this.time.now;
          hudSystem.refreshStatusCounter(this);
        }
      }

      if (nextHp <= 0) {
        // 체력이 0 이하가 되면 사망 처리와 경험치 지급으로 이동.
        this.killMonster(monster);
      }
    }

    showMonsterDamageNumber(monster, amount, ignoreDefense = false) {
      if (amount <= 0) {
        return;
      }

      const existingText = monster.getData("damageText");
      if (existingText?.active) {
        const accumulatedDamage = (monster.getData("accumulatedDamage") || 0) + amount;
        monster.setData("accumulatedDamage", accumulatedDamage);
        existingText.setText(`-${Math.max(1, Math.round(accumulatedDamage)).toLocaleString("ko-KR")}`);
        return;
      }

      const damageText = this.add.text(
        monster.x + Phaser.Math.Between(-12, 12),
        monster.y - 58,
        `-${Math.max(1, Math.round(amount)).toLocaleString("ko-KR")}`,
        {
          fontFamily: "Plus Jakarta Sans, Segoe UI",
          fontSize: monster.getData("isBoss") ? "22px" : "17px",
          color: ignoreDefense ? "#ffcf66" : "#ffffff",
          fontStyle: "900",
          stroke: "#1a1a1b",
          strokeThickness: 4,
        }
      ).setOrigin(0.5).setDepth(80);
      monster.setData("damageText", damageText);
      monster.setData("accumulatedDamage", amount);
      this.tweens.add({
        targets: damageText,
        y: damageText.y - 42,
        alpha: 0,
        duration: 520,
        ease: "Cubic.easeOut",
        onComplete: () => {
          if (monster.active && monster.getData("damageText") === damageText) {
            monster.setData("damageText", null);
            monster.setData("accumulatedDamage", 0);
          }
          damageText.destroy();
        },
      });
    }

    killMonster(monster) {
      // 몬스터 본체뿐 아니라 부가 UI도 같이 정리해야 누수가 없다.
      const hpBar = monster.getData("hpBar");
      const levelText = monster.getData("levelText");
      const level = monster.getData("level");
      const isBoss = monster.getData("isBoss");
      const isFinalBoss = monster.getData("isFinalBoss");
      const specialBossType = monster.getData("specialBossType");
      const rawReward = Math.round(
        leveling.getMonsterXpReward(level) *
          (isBoss ? config.stage.bossXpMultiplier : 1) *
          this.getStageScale(config.stage.xpRewardMultiplierPerStage)
      );
      const maxReward = Math.ceil(
        this.playerState.xpToNext * (
          isBoss
            ? config.progression.bossKillMaxXpRatio
            : config.progression.normalKillMaxXpRatio
        )
      );
      const reward = Math.min(rawReward, maxReward);

      hpBar?.destroy();
      levelText?.destroy();
      monster.destroy();

      if (isBoss) {
        this.bossMonster = null;
        this.finalBossActive = false;
      }

      if (specialBossType && specialBossType !== "awakening") {
        const item = this.createSupremeBossDrop(specialBossType, level);
        this.playerState.inventory.unshift(item);
        this.renderInventory();
        this.showLootToast(item);
      } else if (!specialBossType) {
        this.maybeAutoLootEquipment(level, isBoss, isFinalBoss);
      }
      this.gainExperience(reward);

      if (specialBossType) {
        if (specialBossType === "awakening") {
          this.awakenAsGladiator();
        }
        this.finishSpecialBossBattle();
      } else if (isBoss) {
        this.clearStage();
      }
    }

    finishSpecialBossBattle() {
      this.bossSpawned = false;
      this.activeSpecialBossType = null;
      this.waterDotUntil = 0;
      this.removeActiveEnemies();
      this.startStage();
      this.startMonsterSpawner();
      this.refreshUi(true);
      this.updateSpecialBossButtons();
    }

    gainExperience(amount) {
      // 한 번에 여러 레벨이 오를 수 있으므로 while로 처리한다.
      this.playerState.xp += amount;

      while (this.playerState.xp >= this.playerState.xpToNext) {
        this.playerState.xp -= this.playerState.xpToNext;
        // 레벨업 보너스를 적용한 뒤 파생 스탯을 다시 계산한다.
        this.playerState.level += 1;
        this.playerState.strength += 1;
        this.playerState.levelDamageBonus += 0.7;
        this.playerState.levelDefenseBonus += 0.3;
        if (this.playerState.level % 4 === 0) {
          this.playerState.dexterity += 1;
        }
        if (this.playerState.level % 5 === 0) {
          this.playerState.knowledge += 1;
        }
        const shouldPromote =
          !this.playerState.isGladiator &&
          this.playerState.level >= config.player.promotion.requiredLevel;
        const shouldSecondJobRebirth =
          this.playerState.isGladiator &&
          !this.playerState.isGladiatorSecondJob &&
          this.playerState.level >= config.player.promotion.secondJobRequiredLevel;
        if (shouldPromote) {
          this.promoteToGladiator();
        } else if (shouldSecondJobRebirth) {
          this.rebirthAsGladiatorSecondJob();
        }
        this.playerState.hp = this.playerState.maxHp;
        this.recalculatePlayerStats();
        this.playerState.hp = this.playerState.maxHp;
        this.playerState.xpToNext = leveling.getXpToNext(
          this.playerState.level + 1,
          this.getProgressionXpMultiplier()
        );
        if (shouldPromote || shouldSecondJobRebirth) {
          break;
        }
        this.playLevelUpEffect(this.playerState.level);
      }

      this.refreshUi();
    }

    promoteToGladiator() {
      const promotion = config.player.promotion;
      this.playerState.strength = Math.round(this.playerState.strength * promotion.strengthMultiplier);
      this.playerState.dexterity = Math.round(this.playerState.dexterity * promotion.dexterityMultiplier);
      this.playerState.knowledge = Math.round(this.playerState.knowledge * promotion.knowledgeMultiplier);
      this.playerState.isGladiator = true;
      this.playerState.level = 1;
      this.playerState.xp = 0;
      this.playerState.xpToNext = leveling.getXpToNext(2, this.getProgressionXpMultiplier());
      this.attackSpeedBuffUntil = 0;
      this.applyPlayerAppearance();
      this.playPromotionEffect("검투사 전직!");
    }

    rebirthAsGladiatorSecondJob() {
      const promotion = config.player.promotion;
      this.playerState.strength = Math.round(
        this.playerState.strength * promotion.secondJobStrengthMultiplier
      );
      this.playerState.dexterity = Math.round(
        this.playerState.dexterity * promotion.secondJobDexterityMultiplier
      );
      this.playerState.knowledge = Math.round(
        this.playerState.knowledge * promotion.secondJobKnowledgeMultiplier
      );
      this.playerState.isGladiatorSecondJob = true;
      this.playerState.level = 1;
      this.playerState.xp = 0;
      this.playerState.xpToNext = leveling.getXpToNext(2, this.getProgressionXpMultiplier());
      this.skillCooldownUntil = 0;
      this.demonModeUntil = 0;
      this.guaranteedCriticalUntil = 0;
      this.attackSpeedBuffUntil = 0;
      this.applyPlayerAppearance();
      this.playPromotionEffect("검투사 2차 환생!");
      this.updateSpecialBossButtons();
    }

    awakenAsGladiator() {
      if (this.playerState.isAwakened) {
        return;
      }
      const awakening = config.player.promotion.awakening;
      this.playerState.strength = Math.round(this.playerState.strength * awakening.strengthMultiplier);
      this.playerState.dexterity = Math.round(this.playerState.dexterity * awakening.dexterityMultiplier);
      this.playerState.knowledge = Math.round(this.playerState.knowledge * awakening.knowledgeMultiplier);
      this.playerState.isAwakened = true;
      this.playerState.level = 1;
      this.playerState.xp = 0;
      this.playerState.xpToNext = leveling.getXpToNext(2, this.getProgressionXpMultiplier());
      this.skillCooldownUntil = 0;
      this.demonModeUntil = 0;
      this.guaranteedCriticalUntil = 0;
      this.attackSpeedBuffUntil = 0;
      this.recalculatePlayerStats();
      this.playerState.hp = this.playerState.maxHp;
      this.applyPlayerAppearance();
      this.playPromotionEffect("각성 환생!");
      this.updateSpecialBossButtons();
    }

    applyPlayerAppearance() {
      if (!this.player?.active) {
        return;
      }

      this.player.setTexture(this.getPlayerTextureKey("idle"));
      this.updatePlayerEffects(this.time.now);
    }

    updatePlayerEffects(time) {
      this.legendaryWings
        ?.setPosition(this.player.x, this.player.y + 18)
        .setVisible(this.activeLegendaryEffects.wingedShoes && !this.gameOver);
      this.legendaryArmorAura
        ?.setPosition(this.player.x, this.player.y + 2)
        .setVisible(this.activeLegendaryEffects.physicalGuard && !this.gameOver);

      if (!this.playerState.isGladiator || this.gameOver) {
        const visualState = this.gameOver ? "game-over" : "warrior";
        if (visualState !== this.lastPlayerVisualState) {
          this.promotionAura?.setVisible(false);
          if (!this.gameOver) {
            this.player.clearTint();
          }
          this.lastPlayerVisualState = visualState;
        }
        return;
      }

      const demonModeActive = time < this.demonModeUntil;
      this.promotionAura
        ?.setPosition(this.player.x, this.player.y + 2)
        .setVisible(true);
      const visualState = demonModeActive ? "demon" : this.playerState.isAwakened ? "awakened" : "gladiator";
      if (visualState === this.lastPlayerVisualState) {
        return;
      }

      this.lastPlayerVisualState = visualState;
      this.promotionAura
        ?.setFillStyle(
          demonModeActive ? 0x8f1238 : this.playerState.isAwakened ? 0x7616bd : 0xffdc73,
          demonModeActive ? 0.34 : this.playerState.isAwakened ? 0.3 : 0.18
        )
        .setStrokeStyle(3, demonModeActive ? 0xff4c64 : this.playerState.isAwakened ? 0xe6a4ff : 0xfff4b0, 0.9);
      this.player.setTint(
        demonModeActive ? 0xff6680 : this.playerState.isAwakened ? 0xe0a2ff : 0xfff4b0,
        demonModeActive ? 0x8f1238 : this.playerState.isAwakened ? 0x8d38cb : 0xb9eaff,
        demonModeActive ? 0xff294f : this.playerState.isAwakened ? 0xffffff : 0xffffff,
        demonModeActive ? 0x4f071d : this.playerState.isAwakened ? 0x541080 : 0xffdc73
      );
    }

    playPromotionEffect(titleLabel) {
      const ring = this.add.circle(this.player.x, this.player.y, 30).setDepth(46);
      ring.setStrokeStyle(9, 0xffe47d, 1);
      const title = this.add.text(this.player.x, this.player.y - 82, titleLabel, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "30px",
        color: "#fff4b0",
        fontStyle: "800",
        stroke: "#5a2600",
        strokeThickness: 6,
      }).setOrigin(0.5).setDepth(47);

      this.tweens.add({
        targets: ring,
        scaleX: 7,
        scaleY: 7,
        alpha: 0,
        duration: 760,
        onComplete: () => ring.destroy(),
      });
      this.tweens.add({
        targets: title,
        y: this.player.y - 132,
        alpha: 0,
        duration: 1200,
        onComplete: () => title.destroy(),
      });
    }

    playLevelUpEffect(level) {
      // 전투 로직과 무관한 시각 효과 전용 함수.
      const flash = this.add.circle(this.player.x, this.player.y, 24, 0xfff1ab, 0.55).setDepth(40);
      const ring = this.add.circle(this.player.x, this.player.y, 18).setDepth(41);
      ring.setStrokeStyle(5, 0xf7c95c, 1);
      const levelText = this.add.text(this.player.x, this.player.y - 64, `LEVEL ${level}!`, {
        fontFamily: "Segoe UI",
        fontSize: "24px",
        color: "#fff4c3",
        fontStyle: "700",
        stroke: "#7a4c15",
        strokeThickness: 5,
      }).setOrigin(0.5).setDepth(42);

      this.tweens.add({
        targets: flash,
        scaleX: 3,
        scaleY: 3,
        alpha: 0,
        duration: 280,
        onComplete: () => flash.destroy(),
      });

      this.tweens.add({
        targets: ring,
        scaleX: 4.2,
        scaleY: 4.2,
        alpha: 0,
        duration: 420,
        onComplete: () => ring.destroy(),
      });

      this.tweens.add({
        targets: levelText,
        y: this.player.y - 112,
        alpha: 0,
        duration: 760,
        ease: "Cubic.easeOut",
        onComplete: () => levelText.destroy(),
      });
    }

    updateProjectiles(time) {
      // 추적과 수명 정리를 한 번의 순회에서 처리한다.
      this.enemyProjectiles.getChildren().forEach((projectile) => {
        if (!projectile.active) {
          return;
        }

        const outOfBounds =
          projectile.x < -40 ||
          projectile.x > config.world.width + 40 ||
          projectile.y < -40 ||
          projectile.y > config.world.height + 40;
        const expired = time - projectile.getData("spawnedAt") > 3000;

        if (outOfBounds || expired) {
          projectile.destroy();
          return;
        }

        this.physics.moveToObject(projectile, this.player, projectile.getData("speed"));
      });
    }

    update(time) {
      // Phaser가 매 프레임 호출하는 핵심 루프.
      // 입력/AI/전투/투사체/UI 위치 갱신이 여기서 이어진다.
      this.updateStageFlow();
      this.updatePlayerMovement(time);
      this.updateMonsters(time);
      this.updatePlayerStatusEffects(time);
      this.handleAutoAttack(time);
      this.updateInfernoWeapon(time);
      this.handleSkillCast(time);
      this.updateProjectiles(time);
      this.updatePlayerEffects(time);
      this.drawPlayerHud();
      this.updateStatusCounter(time);
    }
  }

  global.DungeonScene = DungeonScene;
})(window);
