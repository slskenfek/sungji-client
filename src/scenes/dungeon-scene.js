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
      this.stageStartedAt = 0;
      this.waveEnded = false;
      this.bossSpawned = false;
      this.stageCleared = false;
      this.gameOver = false;
      this.bossMonster = null;
      this.stageClearText = null;
      this.gameOverOverlay = null;
      this.gameOverRestartBounds = null;
      this.gameOverPointerHandler = null;
      this.lastStageUiSecond = -1;
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
      this.refreshUi();
    }

    startStage() {
      // 현재는 풀숲 스테이지 1개만 존재하며, create 시점부터 카운트가 시작된다.
      this.stageStartedAt = this.time.now;
      this.waveEnded = false;
      this.bossSpawned = false;
      this.stageCleared = false;
      this.bossMonster = null;
      this.lastStageUiSecond = -1;
      this.stageClearText?.destroy();
      this.stageClearText = null;
      this.refreshUi();
    }

    registerInputs() {
      // 화살표 키와 WASD를 함께 지원한다.
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D,SHIFT");
      this.skillKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
    }

    startMonsterSpawner() {
      // 일정 주기마다 spawnMonster를 호출하는 타이머 등록.
      this.monsterSpawner = this.time.addEvent({
        delay: config.monsters.spawnInterval,
        loop: true,
        callback: () => {
          if (this.waveEnded || this.stageCleared) {
            return;
          }
          this.spawnMonster();
        },
      });
    }

    refreshUi() {
      // playerState 값을 HUD에 반영하는 얇은 진입점.
      hudSystem.refreshHud(this, this.hud);
      this.renderInventory();
    }

    getStageElapsedTime() {
      return Math.max(0, this.time.now - this.stageStartedAt);
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
        return "BOSS";
      }

      return `${minutes}:${seconds}`;
    }

    getSkillStatusText() {
      if (this.time.now >= this.skillCooldownUntil) {
        return "READY";
      }

      const seconds = Math.ceil((this.skillCooldownUntil - this.time.now) / 1000);
      return `${seconds}s`;
    }

    getSkillProfile() {
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
      const buffMultiplier = time < this.attackSpeedBuffUntil ? 1.2 : 1;
      return this.playerState.attackRateStage * buffMultiplier;
    }

    getStageStatusText() {
      if (this.stageCleared) {
        return "CLEAR";
      }

      if (this.bossSpawned) {
        return "BOSS 등장";
      }

      const seconds = Math.ceil(this.getRemainingWaveTime() / 1000);
      return `보스까지 ${String(seconds).padStart(2, "0")}초`;
    }

    getStageWorldLabel() {
      if (this.stageCleared) {
        return `STAGE ${String(config.stage.number).padStart(2, "0")} CLEAR`;
      }

      if (this.bossSpawned) {
        return `BOSS | ${config.stage.label}`;
      }

      return `STAGE ${String(config.stage.number).padStart(2, "0")}`;
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
      this.stageClearText = this.add.text(640, 360, "STAGE CLEAR!", {
        fontFamily: "Segoe UI",
        fontSize: "46px",
        color: "#fff1ad",
        fontStyle: "700",
        stroke: "#37501f",
        strokeThickness: 8,
      }).setScrollFactor(0).setDepth(1200).setOrigin(0.5);

      this.tweens.add({
        targets: this.stageClearText,
        scaleX: 1.06,
        scaleY: 1.06,
        yoyo: true,
        repeat: -1,
        duration: 700,
      });

      this.refreshUi();
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
          config.player.baseDamage +
          this.playerState.levelDamageBonus +
          (strengthDelta + equipmentStats.strength) * 0.65 +
          equipmentStats.damage
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
      this.playerState.maxHp = config.player.maxHp + (strengthDelta + equipmentStats.strength) * 5;
      this.playerState.magicDamage =
        knowledgeDelta + equipmentStats.knowledge >= 0
          ? (config.player.knowledge + knowledgeDelta + equipmentStats.knowledge) * 7
          : 0;
    }

    spawnMonster() {
      // 몬스터 수가 가득 찼으면 더 생성하지 않는다.
      if (this.monsters.getChildren().length >= config.monsters.maxAlive) {
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
      const monsterLevel = leveling.getMonsterLevel(this.playerState.level, config.room.minMonsterLevel);
      const monsterMaxHp = leveling.getMonsterMaxHp(monsterLevel);

      const variant = this.getMonsterVariantByLevel(monsterLevel);
      const monster = this.physics.add.sprite(spawnX, spawnY, `monster-${variant}-idle`);
      // setData는 엔티티별 상태를 저장하는 간단한 key-value 저장소처럼 쓴다.
      monster.setDepth(18);
      monster.setScale(this.getMonsterScaleByLevel(monsterLevel));
      monster.setData("variant", variant);
      monster.setData("speciesName", this.getMonsterSpeciesName(variant));
      monster.setData("level", monsterLevel);
      monster.setData("defenseMultiplier", leveling.getMonsterDefenseMultiplier(monsterLevel));
      monster.setData("hp", monsterMaxHp);
      monster.setData("maxHp", monsterMaxHp);
      monster.setData("speed", Phaser.Math.Between(config.monsters.speedMin, config.monsters.speedMax));
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

    maybeAutoLootEquipment(level, isBoss) {
      const shouldDrop = isBoss || Phaser.Math.Between(1, 100) <= 30;
      if (!shouldDrop) {
        return;
      }

      const item = this.createEquipmentItem(level, isBoss);
      this.playerState.inventory.unshift(item);
      this.renderInventory();
      this.showLootToast(item);
    }

    createEquipmentItem(level, isBoss) {
      const rarityRoll = isBoss ? 100 : Phaser.Math.Between(1, 100);
      const rarity =
        isBoss ? "전설" :
        rarityRoll >= 92 ? "전설" :
        rarityRoll >= 72 ? "희귀" :
        rarityRoll >= 42 ? "고급" :
        "일반";
      const rarityPower = { 일반: 1, 고급: 1.45, 희귀: 2.1, 전설: 3.2 }[rarity];
      const levelPower = isBoss
        ? Math.max(40, Math.round(Math.pow(Math.max(1, level), 1.7) * 14))
        : Math.max(1, Math.round(Math.pow(Math.max(1, level), 1.35) * rarityPower));
      const templates = [
        { type: "weapon", name: "전사의 검", stats: { damage: 4 + levelPower * 2, strength: Math.ceil(levelPower / 3) } },
        { type: "shoes", name: "가죽 신발", stats: { dexterity: 1 + Math.ceil(levelPower / 2), defense: Math.ceil(levelPower / 4) } },
        { type: "armor", name: "은빛 갑옷", stats: { defense: 3 + levelPower, strength: Math.ceil(levelPower / 4) } },
        { type: "helmet", name: "강철 투구", stats: { defense: 2 + levelPower, knowledge: Math.ceil(levelPower / 5) } },
        { type: "accessory", name: "번개의 반지", stats: { damage: 1 + levelPower, dexterity: Math.ceil(levelPower / 3) } },
        { type: "accessory", name: "푸른 보석 목걸이", stats: { knowledge: Math.ceil(levelPower / 2), damage: Math.ceil(levelPower / 2) } },
      ];
      const template = Phaser.Utils.Array.GetRandom(templates);

      return {
        id: `${Date.now()}-${Phaser.Math.Between(1000, 9999)}`,
        name: `${isBoss ? "차원 전설" : rarity} ${template.name}`,
        baseName: template.name,
        upgradeLevel: 0,
        type: template.type,
        level,
        rarity,
        stats: template.stats,
        baseStats: { ...template.stats },
      };
    }

    equipItem(index) {
      const nextItem = this.playerState.inventory[index];
      if (!nextItem) {
        return;
      }

      if (this.tryUpgradeSameAccessory(nextItem, index)) {
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
      this.refreshUi();
    }

    tryUpgradeSameAccessory(nextItem, inventoryIndex) {
      if (nextItem.type !== "accessory") {
        return false;
      }

      const sameSlotKey = ["accessory1", "accessory2"].find((slotKey) => {
        const equippedItem = this.playerState.equippedItems[slotKey];
        return this.getNormalizedItemName(equippedItem) === this.getNormalizedItemName(nextItem);
      });

      if (!sameSlotKey) {
        return false;
      }

      const equippedItem = this.playerState.equippedItems[sameSlotKey];
      equippedItem.upgradeLevel = (equippedItem.upgradeLevel || 0) + 1;
      Object.entries(nextItem.stats).forEach(([key, value]) => {
        equippedItem.stats[key] = Number(((equippedItem.stats[key] || 0) + value * 0.3).toFixed(2));
      });
      equippedItem.name = this.getUpgradedItemName(equippedItem);

      this.playerState.inventory.splice(inventoryIndex, 1);
      this.recalculatePlayerStats();
      this.playerState.hp = Math.min(this.playerState.hp, this.playerState.maxHp);
      this.refreshUi();
      return true;
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
        .replace(/^(차원 전설|전설|희귀|고급|일반)\s+/, "")
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
        const effectLabel = item?.type === "accessory" ? "중복 +30% 강화" : "장착 적용";
        stats.textContent = item ? `${this.getItemTypeLabel(item)} ${effectLabel} | ${this.formatItemStats(item)}` : "더블클릭 장착";

        body.append(title, stats);
        row.append(icon, body);
        equippedElement.appendChild(row);
      });

      inventoryElement.innerHTML = "";
      if (this.playerState.inventory.length === 0) {
        const empty = document.createElement("div");
        empty.className = "inventory-empty";
        empty.textContent = "획득한 장비 없음";
        inventoryElement.appendChild(empty);
        return;
      }

      this.playerState.inventory.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "inventory-item";
        row.title = "더블클릭하면 장착됩니다";
        row.ondblclick = () => this.equipItem(index);

        const icon = document.createElement("div");
        icon.className = `item-icon ${this.getItemIconClass(item)}`;

        const body = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;
        const stats = document.createElement("span");
        stats.textContent = `${this.getItemTypeLabel(item)} | LV${item.level} | ${this.formatItemStats(item)}`;

        body.append(name, stats);
        row.append(icon, body);
        inventoryElement.appendChild(row);
      });
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

      return Object.entries(item.stats)
        .map(([key, value]) => `${labels[key]} +${value}`)
        .join(", ");
    }

    showLootToast(item) {
      const toast = this.add.text(640, 604, `자동 습득: ${item.name}`, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "15px",
        color: "#ffe2ab",
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

    spawnBoss() {
      if (this.bossSpawned || this.stageCleared) {
        return;
      }

      if (this.gameOver) {
        return;
      }

      // 일반 웨이브를 끝내고 보스전만 남기기 위해 기존 적을 정리한다.
      this.removeActiveEnemies();

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(420, 560);
      const spawnX = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 120, config.world.width - 120);
      const spawnY = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 120, config.world.height - 120);
      const bossLevel = Math.max(config.room.minMonsterLevel, this.playerState.level + 2);
      const bossProfile = this.getBossProfile(bossLevel);
      const bossBaseHp = leveling.getMonsterMaxHp(bossLevel);
      const bossMaxHp = Math.max(
        220,
        Math.round(bossBaseHp * config.monsters.bossHpMultiplier * bossProfile.hpMultiplier)
      );

      const boss = this.physics.add.sprite(spawnX, spawnY, "boss-idle");
      boss.setScale(config.monsters.bossScale * bossProfile.scale);
      boss.setTint(bossProfile.tint);
      boss.setDepth(22);
      boss.setCollideWorldBounds(true);
      boss.setData("isBoss", true);
      boss.setData("bossProfile", bossProfile);
      boss.setData("level", bossLevel);
      boss.setData("hp", bossMaxHp);
      boss.setData("maxHp", bossMaxHp);
      boss.setData("speed", Math.round(config.monsters.speedMax * config.monsters.bossSpeedMultiplier * bossProfile.speedMultiplier));
      boss.setData("attackRange", config.monsters.attackRangeMax + 70);
      boss.setData("defenseMultiplier", leveling.getMonsterDefenseMultiplier(bossLevel) + bossProfile.defenseBonus);
      boss.setData("nextShotAt", this.time.now + 900);

      const hpBar = this.add.graphics().setDepth(34);
      const levelText = this.add.text(boss.x, boss.y - 72, `${bossProfile.name} LV:${bossLevel}`, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: "13px",
        color: bossProfile.labelColor,
        stroke: "#1a1a1b",
        strokeThickness: 3,
        fontStyle: "700",
      }).setOrigin(0.5).setDepth(35);

      boss.setData("hpBar", hpBar);
      boss.setData("levelText", levelText);

      this.monsters.add(boss);
      this.bossMonster = boss;
      this.bossSpawned = true;
      this.refreshUi();
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
      if (this.gameOver) {
        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        return;
      }

      // 입력 -> 속도 계산 -> 방향/애니메이션 반영 순서로 진행된다.
      const sprinting = this.wasd.SHIFT.isDown;
      const speed = config.player.speed * (sprinting ? 1.4 : 1);
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
        this.player.anims.play("warrior-run", true);
      } else {
        this.player.anims.stop();
        this.player.setTexture("warrior-idle");
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

        this.updateMonsterAnimation(monster, time);

        this.drawMonsterHud(monster);
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
        monster.setTexture(attackKey);
        return;
      }

      if (moving) {
        monster.anims.play(runKey, true);
      } else {
        monster.anims.stop();
        monster.setTexture(idleKey);
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
      const speciesName = monster.getData("speciesName");
      const barWidth = isBoss ? 92 : 42 + Math.min(level, 4) * 4;
      const barY = isBoss ? monster.y - 58 : monster.y - 36 - (monster.scaleY - 1) * 20;
      const textY = isBoss ? monster.y - 74 : monster.y - 48 - (monster.scaleY - 1) * 20;

      hpBar.clear();
      hpBar.fillStyle(0x1a1a1b, 0.95);
      hpBar.fillRoundedRect(monster.x - barWidth / 2, barY, barWidth, isBoss ? 8 : 6, 3);
      hpBar.fillStyle(isBoss ? bossProfile?.hpColor || 0xffbf00 : 0xff6d62, 1);
      hpBar.fillRoundedRect(monster.x - barWidth / 2, barY, barWidth * ratio, isBoss ? 8 : 6, 3);
      hpBar.lineStyle(1, 0xffe2ab, 0.5);
      hpBar.strokeRoundedRect(monster.x - barWidth / 2, barY, barWidth, isBoss ? 8 : 6, 3);

      if (!isBoss && speciesName) {
        levelText.setText(`LV${level} ${speciesName}`);
      }
      levelText.setPosition(monster.x, textY);
    }

    drawPlayerHud() {
      // 플레이어가 움직일 때 머리 위 레벨 라벨도 같이 따라오게 한다.
      if (!this.playerLevelText?.active) {
        return;
      }

      this.playerLevelText.setText(`LV:${this.playerState.level}`);
      this.playerLevelText.setPosition(this.player.x, this.player.y - 52);
    }

    fireMonsterProjectile(monster) {
      // 투사체 생성 -> 속도 부여 -> group 등록 순서.
      const projectile = this.physics.add.image(monster.x, monster.y - 4, "enemy-shot");
      const isBoss = monster.getData("isBoss");
      projectile.setDepth(24);
      projectile.setScale(isBoss ? 1.4 : 1);
      projectile.setData(
        "damage",
        isBoss
          ? Math.round((config.monsters.projectileDamage + monster.getData("level") * 2) * config.monsters.bossProjectileDamageMultiplier)
          : config.monsters.projectileDamage + monster.getData("level") * 2
      );
      projectile.setData("spawnedAt", this.time.now);
      projectile.setData("speed", config.monsters.projectileSpeed);
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
      const reducedDamage = Math.max(1, incomingDamage - this.playerState.defense);
      this.playerState.hp = Math.max(0, this.playerState.hp - reducedDamage);
      projectile.destroy();
      this.refreshUi();

      if (this.playerState.hp <= 0) {
        this.showGameOver();
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
      this.attackCooldown = time + Math.max(120, config.player.attackCooldownBase / this.getEffectiveAttackRateStage(time));
      this.playerAttackLockedUntil = time + 140;

      this.playMeleeAttack(target);
      this.damageMonster(target, this.playerState.damage);
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

      this.skillCooldownUntil = time + config.stage.skillCooldown;
      const skillProfile = this.getSkillProfile();
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
      let nearestDistance = config.player.attackRange;

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

    playMeleeAttack(target) {
      // 플레이어 방향 전환 + 공격 텍스처 + slash 이펙트를 묶은 연출.
      const facingLeft = target.x < this.player.x;
      this.player.setFlipX(facingLeft);
      this.player.anims.stop();
      this.player.setTexture("warrior-attack");

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
          this.player.anims.play("warrior-run", true);
        } else {
          this.player.setTexture("warrior-idle");
        }
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
      this.player.setTexture("warrior-idle");
      this.player.setTint(0x6d7480);
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
      this.player.setPosition(1200, 1200);
      this.player.setVelocity(0, 0);
      this.player.clearTint();
      this.player.setActive(true).setVisible(true);
      this.player.anims.stop();
      this.player.setTexture("warrior-idle");
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

    damageMonster(monster, amount) {
      // 몬스터 레벨 기반 방어 배율을 적용한 뒤 HP를 감소시킨다.
      if (!monster.active) {
        return;
      }

      const defenseMultiplier = monster.getData("defenseMultiplier") || 1;
      const mitigatedDamage = Math.max(0.1, amount / defenseMultiplier);
      const nextHp = Math.max(0, monster.getData("hp") - mitigatedDamage);
      monster.setData("hp", nextHp);
      this.drawMonsterHud(monster);

      if (nextHp <= 0) {
        // 체력이 0 이하가 되면 사망 처리와 경험치 지급으로 이동.
        this.killMonster(monster);
      }
    }

    killMonster(monster) {
      // 몬스터 본체뿐 아니라 부가 UI도 같이 정리해야 누수가 없다.
      const hpBar = monster.getData("hpBar");
      const levelText = monster.getData("levelText");
      const level = monster.getData("level");
      const isBoss = monster.getData("isBoss");
      const reward = leveling.getMonsterXpReward(level) * (isBoss ? config.stage.bossXpMultiplier : 1);

      hpBar?.destroy();
      levelText?.destroy();
      monster.destroy();

      if (isBoss) {
        this.bossMonster = null;
      }

      this.maybeAutoLootEquipment(level, isBoss);
      this.gainExperience(reward);

      if (isBoss) {
        this.clearStage();
      }
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
        this.playerState.hp = this.playerState.maxHp;
        this.recalculatePlayerStats();
        this.playerState.hp = this.playerState.maxHp;
        this.playerState.xpToNext = leveling.getXpToNext(this.playerState.level + 1);
        this.playLevelUpEffect(this.playerState.level);
      }

      this.refreshUi();
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

    updateProjectiles() {
      // 발사된 투사체는 매 프레임 플레이어를 계속 추적한다.
      this.enemyProjectiles.getChildren().forEach((projectile) => {
        if (!projectile.active) {
          return;
        }

        this.physics.moveToObject(projectile, this.player, projectile.getData("speed"));
      });
    }

    cleanupProjectiles() {
      // 화면 밖으로 나갔거나 오래된 투사체는 정리한다.
      this.enemyProjectiles.getChildren().forEach((projectile) => {
        if (!projectile.active) {
          return;
        }

        const outOfBounds =
          projectile.x < -40 ||
          projectile.x > config.world.width + 40 ||
          projectile.y < -40 ||
          projectile.y > config.world.height + 40;
        const expired = this.time.now - projectile.getData("spawnedAt") > 3000;

        if (outOfBounds || expired) {
          projectile.destroy();
        }
      });
    }

    update(time) {
      // Phaser가 매 프레임 호출하는 핵심 루프.
      // 입력/AI/전투/투사체/UI 위치 갱신이 여기서 이어진다.
      this.updateStageFlow();
      this.updatePlayerMovement(time);
      this.updateMonsters(time);
      this.handleAutoAttack(time);
      this.handleSkillCast(time);
      this.updateProjectiles();
      this.cleanupProjectiles();
      this.drawPlayerHud();
    }
  }

  global.DungeonScene = DungeonScene;
})(window);
