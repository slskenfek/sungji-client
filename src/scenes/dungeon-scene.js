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
      this.stageStartedAt = 0;
      this.waveEnded = false;
      this.bossSpawned = false;
      this.stageCleared = false;
      this.bossMonster = null;
      this.stageClearText = null;
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
      background.fillGradientStyle(0x5a8d46, 0x5a8d46, 0x355b2f, 0x355b2f, 1);
      background.fillRect(0, 0, config.world.width, config.world.height);
      background.fillStyle(0x6aa34f, 0.16);
      for (let i = 0; i < 180; i += 1) {
        const size = Phaser.Math.Between(40, 120);
        background.fillCircle(
          Phaser.Math.Between(0, config.world.width),
          Phaser.Math.Between(0, config.world.height),
          size
        );
      }

      background.lineStyle(2, 0x6b5130, 0.55);
      background.strokeRoundedRect(300, 300, 1800, 1800, 42);
      background.lineStyle(3, 0x83633d, 0.65);
      background.strokeRoundedRect(540, 540, 1320, 1320, 28);

      // 십자형 흙길. 플레이 동선과 미니맵 가독성을 동시에 담당한다.
      const trail = this.add.graphics();
      trail.fillStyle(0x8b6b43, 0.9);
      trail.fillRoundedRect(1120, 360, 160, 1680, 46);
      trail.fillRoundedRect(560, 1120, 1280, 160, 46);
      trail.fillStyle(0xb08a5a, 0.22);
      trail.fillRoundedRect(1152, 388, 96, 1624, 38);
      trail.fillRoundedRect(588, 1152, 1224, 96, 38);

      // 방 외곽 느낌을 주는 배경 패널/테두리.
      const roomGraphics = this.add.graphics();
      roomGraphics.fillStyle(0x294326, 0.42);
      roomGraphics.fillRoundedRect(332, 332, 1736, 1736, 42);
      roomGraphics.lineStyle(4, 0xb2905f, 0.85);
      roomGraphics.strokeRoundedRect(360, 360, 1680, 1680, 36);
      roomGraphics.lineStyle(2, 0xe1c98f, 0.35);
      roomGraphics.strokeRoundedRect(402, 402, 1596, 1596, 32);

      // 나무/연못/수풀 등 지형지물 배치.
      this.decorateTerrain();

      // 월드 상단 중앙에 보이는 방 이름 라벨.
      this.roomLabel = this.add
        .text(1200, 220, "ROOM 01", {
          fontFamily: "Segoe UI",
          fontSize: "42px",
          color: "#f7dc94",
          fontStyle: "700",
          stroke: "#31491d",
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
        fontFamily: "Segoe UI",
        fontSize: "12px",
        color: "#fff0b5",
        fontStyle: "700",
        stroke: "#081015",
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
      if (this.stageCleared || this.bossSpawned) {
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
      if (this.stageCleared) {
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

      this.playerState.attackRateStage = Number(
        (config.player.baseAttackRateStage + dexterityDelta * 0.12).toFixed(2)
      );
      this.playerState.attackSpeed = this.playerState.attackRateStage;
      this.playerState.damage = Number(
        (config.player.baseDamage + this.playerState.levelDamageBonus + strengthDelta * 0.35).toFixed(2)
      );
      this.playerState.defense = Number(
        (config.player.defense + this.playerState.levelDefenseBonus + dexterityDelta * 0.3).toFixed(2)
      );
      this.playerState.maxHp = config.player.maxHp + strengthDelta * 5;
      this.playerState.magicDamage = knowledgeDelta >= 0 ? (config.player.knowledge + knowledgeDelta) * 7 : 0;
    }

    spawnMonster() {
      // 몬스터 수가 가득 찼으면 더 생성하지 않는다.
      if (this.monsters.getChildren().length >= config.monsters.maxAlive) {
        return;
      }

      // 플레이어 주변 랜덤 원형 범위에서 생성한다.
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(config.monsters.spawnRadiusMin, config.monsters.spawnRadiusMax);
      const spawnX = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 100, config.world.width - 100);
      const spawnY = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 100, config.world.height - 100);
      const monsterLevel = leveling.getMonsterLevel(this.playerState.level, config.room.minMonsterLevel);
      const monsterMaxHp = leveling.getMonsterMaxHp(monsterLevel);

      const variant = Phaser.Math.Between(0, 2);
      const monster = this.physics.add.sprite(spawnX, spawnY, `monster-${variant}-idle`);
      // setData는 엔티티별 상태를 저장하는 간단한 key-value 저장소처럼 쓴다.
      monster.setDepth(18);
      monster.setData("variant", variant);
      monster.setData("level", monsterLevel);
      monster.setData("defenseMultiplier", leveling.getMonsterDefenseMultiplier(monsterLevel));
      monster.setData("hp", monsterMaxHp);
      monster.setData("maxHp", monsterMaxHp);
      monster.setData("speed", Phaser.Math.Between(config.monsters.speedMin, config.monsters.speedMax));
      monster.setData("attackRange", Phaser.Math.Between(config.monsters.attackRangeMin, config.monsters.attackRangeMax));
      monster.setData("nextShotAt", this.time.now + Phaser.Math.Between(config.monsters.attackIntervalMin, config.monsters.attackIntervalMax));

      const hpBar = this.add.graphics().setDepth(30);
      const levelText = this.add.text(monster.x, monster.y - 44, `LV:${monsterLevel}`, {
        fontFamily: "Segoe UI",
        fontSize: "11px",
        color: "#f4e5b5",
        stroke: "#081015",
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(31);

      monster.setData("hpBar", hpBar);
      monster.setData("levelText", levelText);
      this.monsters.add(monster);
    }

    spawnBoss() {
      if (this.bossSpawned || this.stageCleared) {
        return;
      }

      // 일반 웨이브를 끝내고 보스전만 남기기 위해 기존 적을 정리한다.
      this.removeActiveEnemies();

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(420, 560);
      const spawnX = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 120, config.world.width - 120);
      const spawnY = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 120, config.world.height - 120);
      const bossLevel = Math.max(config.room.minMonsterLevel, this.playerState.level + 2);
      const bossBaseHp = leveling.getMonsterMaxHp(bossLevel);
      const bossMaxHp = Math.max(
        220,
        Math.round(bossBaseHp * config.monsters.bossHpMultiplier)
      );

      const boss = this.physics.add.sprite(spawnX, spawnY, "boss-idle");
      boss.setScale(config.monsters.bossScale);
      boss.setDepth(22);
      boss.setCollideWorldBounds(true);
      boss.setData("isBoss", true);
      boss.setData("level", bossLevel);
      boss.setData("hp", bossMaxHp);
      boss.setData("maxHp", bossMaxHp);
      boss.setData("speed", Math.round(config.monsters.speedMax * config.monsters.bossSpeedMultiplier));
      boss.setData("attackRange", config.monsters.attackRangeMax + 70);
      boss.setData("defenseMultiplier", leveling.getMonsterDefenseMultiplier(bossLevel) + 1.2);
      boss.setData("nextShotAt", this.time.now + 900);

      const hpBar = this.add.graphics().setDepth(34);
      const levelText = this.add.text(boss.x, boss.y - 72, `BOSS LV:${bossLevel}`, {
        fontFamily: "Segoe UI",
        fontSize: "13px",
        color: "#ffd98c",
        stroke: "#2a1508",
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

    updatePlayerMovement(time) {
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

        if (distance <= desiredRange && time >= monster.getData("nextShotAt")) {
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
      const barWidth = isBoss ? 86 : 36;
      const barY = isBoss ? monster.y - 56 : monster.y - 34;
      const textY = isBoss ? monster.y - 70 : monster.y - 44;

      hpBar.clear();
      hpBar.fillStyle(isBoss ? 0x2f1209 : 0x160f0f, 0.95);
      hpBar.fillRoundedRect(monster.x - barWidth / 2, barY, barWidth, isBoss ? 8 : 6, 3);
      hpBar.fillStyle(isBoss ? 0xff875e : 0xd35f5f, 1);
      hpBar.fillRoundedRect(monster.x - barWidth / 2, barY, barWidth * ratio, isBoss ? 8 : 6, 3);

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
      if (!projectile.active) {
        return;
      }

      // 방어력만큼 차감하되 최소 피해는 1 보장.
      const incomingDamage = projectile.getData("damage");
      const reducedDamage = Math.max(1, incomingDamage - this.playerState.defense);
      this.playerState.hp = Math.max(0, this.playerState.hp - reducedDamage);
      projectile.destroy();
      this.refreshUi();
    }

    handleAutoAttack(time) {
      // 쿨타임이 끝났고 사거리 내 대상이 있을 때만 자동 공격한다.
      if (time < this.attackCooldown) {
        return;
      }

      const target = this.findNearestMonster();
      if (!target) {
        return;
      }

      // 공속이 올라갈수록 실제 공격 주기가 짧아진다.
      this.attackCooldown = time + Math.max(120, config.player.attackCooldownBase / this.playerState.attackRateStage);
      this.playerAttackLockedUntil = time + 140;

      this.playMeleeAttack(target);
      this.damageMonster(target, this.playerState.damage);
    }

    handleSkillCast(time) {
      if (!Phaser.Input.Keyboard.JustDown(this.skillKey)) {
        return;
      }

      if (time < this.skillCooldownUntil || this.stageCleared) {
        return;
      }

      this.skillCooldownUntil = time + config.stage.skillCooldown;
      const skillDamage = this.playerState.damage * 0.3 + this.playerState.strength * 10;
      const splashRadius = config.stage.skillRadius;

      this.playSkillExplosion(splashRadius);

      this.monsters.getChildren().forEach((monster) => {
        if (!monster.active) {
          return;
        }

        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
        if (distance <= splashRadius) {
          this.damageMonster(monster, skillDamage);
        }
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

    playSkillExplosion(radius) {
      const flash = this.add.circle(this.player.x, this.player.y, 24, 0xffd36e, 0.72).setDepth(39);
      const ring = this.add.circle(this.player.x, this.player.y, 30).setDepth(40);
      ring.setStrokeStyle(8, 0xff9b54, 1);

      this.tweens.add({
        targets: flash,
        scaleX: radius / 18,
        scaleY: radius / 18,
        alpha: 0,
        duration: 260,
        onComplete: () => flash.destroy(),
      });

      this.tweens.add({
        targets: ring,
        scaleX: radius / 15,
        scaleY: radius / 15,
        alpha: 0,
        duration: 320,
        onComplete: () => ring.destroy(),
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
        this.playerState.levelDamageBonus += 0.4;
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
