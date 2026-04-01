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
        level: 1,
      };
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

    spawnMonster() {
      if (this.monsters.getChildren().length >= config.monsters.maxAlive) {
        return;
      }

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(config.monsters.spawnRadiusMin, config.monsters.spawnRadiusMax);
      const spawnX = Phaser.Math.Clamp(this.player.x + Math.cos(angle) * distance, 100, config.world.width - 100);
      const spawnY = Phaser.Math.Clamp(this.player.y + Math.sin(angle) * distance, 100, config.world.height - 100);
      const monsterLevel = leveling.getMonsterLevel(this.playerState.level, config.room.minMonsterLevel);

      const monster = this.physics.add.sprite(
        spawnX,
        spawnY,
        `monster-${Phaser.Math.Between(0, 2)}`
      );
      monster.setDepth(18);
      monster.setData("level", monsterLevel);
      monster.setData("hp", monsterLevel * 2);
      monster.setData("maxHp", monsterLevel * 2);
      monster.setData("speed", Phaser.Math.Between(config.monsters.speedMin, config.monsters.speedMax));
      monster.setData("attackRange", Phaser.Math.Between(config.monsters.attackRangeMin, config.monsters.attackRangeMax));
      monster.setData("nextShotAt", this.time.now + Phaser.Math.Between(config.monsters.attackIntervalMin, config.monsters.attackIntervalMax));

      const hpBar = this.add.graphics().setDepth(30);
      const levelText = this.add.text(monster.x, monster.y - 44, `Lv.${monsterLevel}`, {
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

        if (distance > desiredRange) {
          this.physics.moveToObject(monster, this.player, monster.getData("speed"));
        } else {
          monster.setVelocity(0, 0);
        }

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

        this.drawMonsterHud(monster);
      });
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

    fireMonsterProjectile(monster) {
      const projectile = this.physics.add.image(monster.x, monster.y - 4, "enemy-shot");
      projectile.setDepth(24);
      projectile.setData("damage", config.monsters.projectileDamage + monster.getData("level") * 2);
      projectile.setData("spawnedAt", this.time.now);
      this.physics.moveToObject(projectile, this.player, config.monsters.projectileSpeed);
      this.enemyProjectiles.add(projectile);
    }

    handleProjectileHit(player, projectile) {
      if (!projectile.active) {
        return;
      }

      this.playerState.hp = Math.max(0, this.playerState.hp - projectile.getData("damage"));
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

      this.attackCooldown = time + config.player.attackCooldownByTier[config.player.attackRateTier - 1];
      this.playerAttackLockedUntil = time + 140;

      this.playMeleeAttack(target);
      this.damageMonster(target, 1);
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

      const nextHp = Math.max(0, monster.getData("hp") - amount);
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
        this.playerState.maxHp += 20;
        this.playerState.maxMp += 8;
        this.playerState.hp = this.playerState.maxHp;
        this.playerState.mp = this.playerState.maxMp;
        this.playerState.xpToNext = leveling.getXpToNext(this.playerState.level);
      }

      this.refreshUi();
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
      this.cleanupProjectiles();
    }
  }

  global.DungeonScene = DungeonScene;
})(window);
