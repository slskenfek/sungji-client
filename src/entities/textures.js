// 플레이어, 몬스터, 전투 이펙트 텍스처를 생성한다.
(function attachTextureFactory(global) {
  function createTextures(scene) {
    createWarriorTextures(scene);
    createMonsterTextures(scene);
    createEffectTextures(scene);
  }

  function createWarriorTextures(scene) {
    ["idle", "move-a", "move-b", "attack"].forEach((pose) => {
      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      drawWarriorTexture(graphics, pose);
      graphics.generateTexture(`warrior-${pose}`, 64, 64);
      graphics.destroy();
    });
  }

  function drawWarriorTexture(graphics, pose) {
    const hairOffset = pose === "move-a" ? -1 : pose === "move-b" ? 1 : 0;
    const swordOffset = pose === "move-a" ? 1 : pose === "move-b" ? -1 : pose === "attack" ? 7 : 0;
    const capeOffset = pose === "move-a" ? -2 : pose === "move-b" ? 2 : pose === "attack" ? -4 : 0;
    const swordY = pose === "attack" ? 19 : 29;
    const swordTipY = pose === "attack" ? 12 : 24;
    const leftLegX = pose === "move-a" ? 22 : pose === "attack" ? 23 : 24;
    const rightLegX = pose === "move-a" ? 34 : pose === "attack" ? 33 : 32;
    const shieldY = pose === "attack" ? 37 : 35;

    graphics.fillStyle(0x402515, 1);
    graphics.fillEllipse(32, 22, 30, 28);

    graphics.fillStyle(0x73452b, 1);
    graphics.fillRoundedRect(20 + hairOffset, 11, 24, 12, 6);
    graphics.fillTriangle(24 + hairOffset, 12, 14 + hairOffset, 19, 24 + hairOffset, 23);
    graphics.fillTriangle(40 + hairOffset, 12, 50 + hairOffset, 19, 40 + hairOffset, 23);

    graphics.fillStyle(0xf2d3ba, 1);
    graphics.fillCircle(32, 24, 12);

    graphics.fillStyle(0x1f1a19, 1);
    graphics.fillRect(25, 22, 3, 2);
    graphics.fillRect(36, 22, 3, 2);
    graphics.fillStyle(0xe58e8e, 1);
    graphics.fillRect(29, 28, 6, 2);

    graphics.fillStyle(0xc1ccd9, 1);
    graphics.fillRoundedRect(19, 31, 26, 14, 5);
    graphics.fillStyle(0xe8f0fa, 1);
    graphics.fillRect(29, 31, 6, 14);
    graphics.fillStyle(0x8da0b6, 1);
    graphics.fillRoundedRect(17, 33, 7, 11, 3);
    graphics.fillRoundedRect(40, 33, 7, 11, 3);

    graphics.fillStyle(0xc94d3f, 1);
    graphics.fillTriangle(22 + capeOffset, 35, 13 + capeOffset, 53, 25 + capeOffset, 48);

    graphics.fillStyle(0x5a6f89, 1);
    graphics.fillRoundedRect(22, 43, 20, 9, 4);
    graphics.fillStyle(0xd9b65b, 1);
    graphics.fillRect(29, 43, 6, 9);

    graphics.fillStyle(0xb0977d, 1);
    graphics.fillRoundedRect(15, shieldY, 6, 15, 3);
    graphics.fillStyle(0x4a5668, 1);
    graphics.fillRoundedRect(12, shieldY, 8, 16, 4);
    graphics.lineStyle(2, 0xd5e0ee, 1);
    graphics.strokeRoundedRect(12, shieldY, 8, 16, 4);
    graphics.lineStyle(0, 0, 0);

    graphics.fillStyle(0xe7edf5, 1);
    graphics.fillRect(46 + swordOffset, swordY, 4, 18);
    graphics.fillStyle(0xd5b35b, 1);
    graphics.fillRect(45 + swordOffset, swordY + 16, 6, 3);
    graphics.fillStyle(0x7b5536, 1);
    graphics.fillRect(46 + swordOffset, swordY + 19, 4, 5);
    graphics.fillStyle(0xf6fbff, 1);
    graphics.fillTriangle(48 + swordOffset, swordTipY, 44 + swordOffset, swordY, 52 + swordOffset, swordY);

    graphics.fillStyle(0x2d3a4c, 1);
    graphics.fillRect(leftLegX, 51, 6, 8);
    graphics.fillRect(rightLegX, 51, 6, 8);
    graphics.fillStyle(0x765841, 1);
    graphics.fillRect(leftLegX - 1, 58, 8, 3);
    graphics.fillRect(rightLegX - 1, 58, 8, 3);
  }

  function createMonsterTextures(scene) {
    const variants = [
      { skin: 0x6d8f4e, accent: 0xe7f4b8 },
      { skin: 0x7d5b94, accent: 0xf2d0ff },
      { skin: 0xa15454, accent: 0xffd8ba },
    ];

    variants.forEach((variant, index) => {
      ["idle", "move-a", "move-b", "attack"].forEach((pose) => {
        const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
        drawMonsterTexture(graphics, variant, pose);
        graphics.generateTexture(`monster-${index}-${pose}`, 40, 46);
        graphics.destroy();
      });
    });
  }

  function drawMonsterTexture(graphics, variant, pose) {
    const legOffset = pose === "move-a" ? -2 : pose === "move-b" ? 2 : 0;
    const armOffset = pose === "attack" ? 4 : pose === "move-a" ? 2 : 0;
    const eyeY = pose === "attack" ? 14 : 15;
    const mouthY = pose === "attack" ? 24 : 25;

    graphics.fillStyle(variant.skin, 1);
    graphics.fillCircle(20, 18, 12);
    graphics.fillRoundedRect(10, 25, 20, 15, 6);
    graphics.fillStyle(variant.accent, 1);
    graphics.fillRect(14, eyeY, 4, 4);
    graphics.fillRect(22, eyeY, 4, 4);
    graphics.fillStyle(0x2d1010, 1);
    graphics.fillRect(17, mouthY, 6, 2);
    graphics.fillRect(10 + legOffset, 39, 6, 6);
    graphics.fillRect(24 - legOffset, 39, 6, 6);

    graphics.fillStyle(variant.accent, 1);
    graphics.fillRect(6 + armOffset, 27, 4, 8);
    graphics.fillRect(30, 27, 4, 8);

    if (pose === "attack") {
      graphics.fillStyle(0xffd8b0, 1);
      graphics.fillCircle(6, 22, 4);
    }
  }

  function createEffectTextures(scene) {
    const slash = scene.make.graphics({ x: 0, y: 0, add: false });
    slash.fillStyle(0xf4e5b5, 1);
    slash.fillTriangle(28, 0, 56, 20, 0, 20);
    slash.generateTexture("slash", 56, 20);
    slash.destroy();

    const projectile = scene.make.graphics({ x: 0, y: 0, add: false });
    projectile.fillStyle(0xff8e72, 1);
    projectile.fillCircle(8, 8, 7);
    projectile.fillStyle(0xfff2d6, 1);
    projectile.fillCircle(8, 8, 3);
    projectile.generateTexture("enemy-shot", 16, 16);
    projectile.destroy();
  }

  global.DungeonTextures = {
    createTextures,
  };
})(window);
