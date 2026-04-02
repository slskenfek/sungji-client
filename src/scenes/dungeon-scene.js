// 메인 게임 씬으로 이동, 전투, 스폰, UI 갱신을 조합한다.
(function attachDungeonScene(global) {
  const config = global.DungeonConfig;
  const leveling = global.DungeonLeveling;
  const textures = global.DungeonTextures;
  const hudSystem = global.DungeonHud;

  class DungeonScene extends Phaser.Scene {
    constructor() {
      super("DungeonScene");
      this.attackCooldown = 0;
      this.playerAttackLockedUntil = 0;
      this.playerState = {
        hp: config.player.maxHp,
        maxHp: config.player.maxHp,
        mp: config.player.maxMp,
        maxMp: config.player.maxMp,
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
      this.recalculatePlayerStats();
    }

    preload() {
      textures.createTextures(this);
    }

    create() {
      this.createMap();
      this.createPlayer();
      this.createGroups();
      this.createCameras();
      this.createAnimations();
      this.createUi();
      this.registerInputs();
      this.startMonsterSpawner();
    }

    createMap() {
      this.physics.world.setBounds(0, 0, config.world.width, config.world.height);

      const background = this.add.graphics();
      background.fillGradientStyle(0x172029, 0x172029, 0x0d1318, 0x0d1318, 1);
      background.fillRect(0, 0, config.world.width, config.world.height);
      background.lineStyle(2, 0x202b33, 0.55);

      for (let x = 0; x <= config.world.width; x += 120) {
        background.lineBetween(x, 0, x, config.world.height);
      }
      for (let y = 0; y <= config.world.height; y += 120) {
        background.lineBetween(0, y, config.world.width, y);
      }

      const roomGraphics = this.add.graphics();
      roomGraphics.lineStyle(6, 0x6f4d2f, 1);
      roomGraphics.strokeRoundedRect(300, 300, 1800, 1800, 42);
      roomGraphics.lineStyle(3, 0x34505d, 0.8);
      roomGraphics.strokeRoundedRect(540, 540, 1320, 1320, 28);

      this.roomLabel = this.add
        .text(1200, 220, "ROOM 01", {
          fontFamily: "Segoe UI",
          fontSize: "42px",
          color: "#d59f52",
          fontStyle: "700",
        })
        .setOrigin(0.5);
    }

    createPlayer() {
      this.player = this.physics.add.sprite(1200, 1200, "warrior-idle");
      this.player.setCollideWorldBounds(true);
      this.player.setSize(28, 36);
      this.player.setOffset(18, 20);
      this.player.setDepth(20);

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
      this.monsters = this.physics.add.group();
      this.enemyProjectiles = this.physics.add.group();

      this.physics.add.overlap(this.player, this.enemyProjectiles, this.handleProjectileHit, null, this);
    }

    createCameras() {
      this.cameras.main.setBounds(0, 0, config.world.width, config.world.height);
      this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
      this.cameras.main.setZoom(1.22);

      this.miniMapCamera = this.cameras.add(1016, 24, 240, 150).setZoom(0.13);
      this.miniMapCamera.setBounds(0, 0, config.world.width, config.world.height);
      this.miniMapCamera.startFollow(this.player, true, 0.14, 0.14);
      this.miniMapCamera.setBackgroundColor(0x081015);
    }

    createAnimations() {
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
    }

    createUi() {
      this.hud = hudSystem.createHud(this);
      this.miniMapCamera.ignore(hudSystem.getHudElementsToIgnore(this.hud));
      this.refreshUi();
    }

    registerInputs() {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys("W,A,S,D,SHIFT");
    }

    startMonsterSpawner() {
      this.time.addEvent({
        delay: config.monsters.spawnInterval,
        loop: true,
        callback: () => this.spawnMonster(),
      });
    }

    refreshUi() {
      hudSystem.refreshHud(this, this.hud);
    }

    recalculatePlayerStats() {
      const strengthDelta = this.playerState.strength - config.player.strength;
      const dexterityDelta = this.playerState.dexterity - config.player.dexterity;
      const knowledgeDelta = this.playerState.knowledge - config.player.knowledge;

      this.playerState.attackRateStage = Number(
        (config.player.baseAttackRateStage + dexterityDelta * 0.2).toFixed(2)
      );
      this.playerState.attackSpeed = this.playerState.attackRateStage;
      this.playerState.damage = Number(
        (config.player.baseDamage + this.playerState.levelDamageBonus + strengthDelta * 0.5).toFixed(2)
      );
      this.playerState.defense = Number(
        (config.player.defense + this.playerState.levelDefenseBonus + dexterityDelta * 0.5).toFixed(2)
      );
      this.playerState.maxHp = config.player.maxHp + strengthDelta * 7;
      this.playerState.magicDamage = knowledgeDelta >= 0 ? (config.player.knowledge + knowledgeDelta) * 10 : 0;
    }

    spawnMonster() {
      if (this.monsters.getChildren().length >= config.monsters.maxAlive) {
        return;
      }

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(config.monsters.spawnRadiusMin, config.monsters.spawnRadiusMax);
      const spawnX = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 100, config.world.width - 100);
      const spawnY = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 100, config.world.height - 100);
      const monsterLevel = leveling.getMonsterLevel(this.playerState.level, config.room.minMonsterLevel);

      const variant = Phaser.Math.Between(0, 2);
      const monster = this.physics.add.sprite(spawnX, spawnY, `monster-${variant}-idle`);
      monster.setDepth(18);
      monster.setData("variant", variant);
      monster.setData("level", monsterLevel);
      monster.setData("defenseMultiplier", leveling.getMonsterDefenseMultiplier(monsterLevel));
      monster.setData("hp", 1);
      monster.setData("maxHp", 1);
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

    updatePlayerMovement(time) {
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
      this.monsters.getChildren().forEach((monster) => {
        if (!monster.active) {
          return;
        }

        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
        const desiredRange = monster.getData("attackRange");

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
      const moving = monster.body.velocity.length() > 4;
      const attackLockedUntil = monster.getData("attackLockedUntil") || 0;

      if (time < attackLockedUntil) {
        monster.anims.stop();
        monster.setTexture(`monster-${monster.getData("variant")}-attack`);
        return;
      }

      if (moving) {
        monster.anims.play(`monster-${monster.getData("variant")}-run`, true);
      } else {
        monster.anims.stop();
        monster.setTexture(`monster-${monster.getData("variant")}-idle`);
      }
    }

    drawMonsterHud(monster) {
      const hpBar = monster.getData("hpBar");
      const levelText = monster.getData("levelText");
      const hp = monster.getData("hp");
      const maxHp = monster.getData("maxHp");
      const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);

      hpBar.clear();
      hpBar.fillStyle(0x160f0f, 0.95);
      hpBar.fillRoundedRect(monster.x - 18, monster.y - 34, 36, 6, 3);
      hpBar.fillStyle(0xd35f5f, 1);
      hpBar.fillRoundedRect(monster.x - 18, monster.y - 34, 36 * ratio, 6, 3);

      levelText.setPosition(monster.x, monster.y - 44);
    }

    drawPlayerHud() {
      if (!this.playerLevelText?.active) {
        return;
      }

      this.playerLevelText.setText(`LV:${this.playerState.level}`);
      this.playerLevelText.setPosition(this.player.x, this.player.y - 52);
    }

    fireMonsterProjectile(monster) {
      const projectile = this.physics.add.image(monster.x, monster.y - 4, "enemy-shot");
      projectile.setDepth(24);
      projectile.setData("damage", config.monsters.projectileDamage + monster.getData("level") * 2);
      projectile.setData("spawnedAt", this.time.now);
      projectile.setData("speed", config.monsters.projectileSpeed);
      monster.setData("attackLockedUntil", this.time.now + 180);
      this.physics.moveToObject(projectile, this.player, config.monsters.projectileSpeed);
      this.enemyProjectiles.add(projectile);

      this.tweens.add({
        targets: monster,
        scaleX: 1.08,
        scaleY: 0.92,
        yoyo: true,
        duration: 90,
      });
    }

    handleProjectileHit(player, projectile) {
      if (!projectile.active) {
        return;
      }

      const incomingDamage = projectile.getData("damage");
      const reducedDamage = Math.max(1, incomingDamage - this.playerState.defense);
      this.playerState.hp = Math.max(0, this.playerState.hp - reducedDamage);
      projectile.destroy();
      this.refreshUi();
    }

    handleAutoAttack(time) {
      if (time < this.attackCooldown) {
        return;
      }

      const target = this.findNearestMonster();
      if (!target) {
        return;
      }

      this.attackCooldown = time + Math.max(120, config.player.attackCooldownBase / this.playerState.attackRateStage);
      this.playerAttackLockedUntil = time + 140;

      this.playMeleeAttack(target);
      this.damageMonster(target, this.playerState.damage);
    }

    findNearestMonster() {
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

    damageMonster(monster, amount) {
      if (!monster.active) {
        return;
      }

      const defenseMultiplier = monster.getData("defenseMultiplier") || 1;
      const mitigatedDamage = Math.max(0.1, amount / defenseMultiplier);
      const nextHp = Math.max(0, monster.getData("hp") - mitigatedDamage);
      monster.setData("hp", nextHp);
      this.drawMonsterHud(monster);

      if (nextHp <= 0) {
        this.killMonster(monster);
      }
    }

    killMonster(monster) {
      const hpBar = monster.getData("hpBar");
      const levelText = monster.getData("levelText");
      const level = monster.getData("level");

      hpBar?.destroy();
      levelText?.destroy();
      monster.destroy();

      this.gainExperience(leveling.getMonsterXpReward(level));
    }

    gainExperience(amount) {
      this.playerState.xp += amount;

      while (this.playerState.xp >= this.playerState.xpToNext) {
        this.playerState.xp -= this.playerState.xpToNext;
        this.playerState.level += 1;
        this.playerState.strength += 2;
        this.playerState.levelDamageBonus += 1;
        this.playerState.levelDefenseBonus += 1;
        if (this.playerState.level % 3 === 0) {
          this.playerState.dexterity += 1;
          this.playerState.knowledge += 1;
        }
        this.playerState.hp = this.playerState.maxHp;
        this.playerState.mp = this.playerState.maxMp;
        this.recalculatePlayerStats();
        this.playerState.hp = this.playerState.maxHp;
        this.playerState.xpToNext = leveling.getXpToNext(this.playerState.level + 1);
        this.playLevelUpEffect(this.playerState.level);
      }

      this.refreshUi();
    }

    playLevelUpEffect(level) {
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
      this.enemyProjectiles.getChildren().forEach((projectile) => {
        if (!projectile.active) {
          return;
        }

        this.physics.moveToObject(projectile, this.player, projectile.getData("speed"));
      });
    }

    cleanupProjectiles() {
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
      this.updatePlayerMovement(time);
      this.updateMonsters(time);
      this.handleAutoAttack(time);
      this.updateProjectiles();
      this.cleanupProjectiles();
      this.drawPlayerHud();
    }
  }

  global.DungeonScene = DungeonScene;
})(window);
