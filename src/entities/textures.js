// 플레이어, 몬스터, 전투 이펙트 텍스처를 생성한다.
// 외부 이미지 파일 없이 Phaser Graphics로 직접 그리는 모듈이다.
(function attachTextureFactory(global) {
  function createTextures(scene) {
    // Scene preload() 단계에서 한 번 호출되어 모든 텍스처 key를 등록한다.
    createWarriorTextures(scene);
    createMonsterTextures(scene);
    createBossTextures(scene);
    createEffectTextures(scene);
    createTerrainTextures(scene);
  }

  function createWarriorTextures(scene) {
    // 포즈별 텍스처를 만들어 애니메이션 프레임처럼 사용한다.
    ["idle", "move-a", "move-b", "attack"].forEach((pose) => {
      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      drawWarriorTexture(graphics, pose);
      graphics.generateTexture(`warrior-${pose}`, 64, 64);
      graphics.destroy();
    });
  }

  function drawWarriorTexture(graphics, pose) {
    // 포즈마다 일부 좌표를 살짝 바꿔 "움직이는 것처럼 보이는" 차이를 만든다.
    const hairOffset = pose === "move-a" ? -1 : pose === "move-b" ? 1 : 0;
    const swordOffset = pose === "move-a" ? 1 : pose === "move-b" ? -1 : pose === "attack" ? 8 : 0;
    const capeOffset = pose === "move-a" ? -2 : pose === "move-b" ? 2 : pose === "attack" ? -5 : 0;
    const swordY = pose === "attack" ? 17 : 28;
    const swordTipY = pose === "attack" ? 9 : 22;
    const leftLegX = pose === "move-a" ? 23 : pose === "attack" ? 24 : 25;
    const rightLegX = pose === "move-a" ? 35 : pose === "attack" ? 34 : 33;
    const shieldY = pose === "attack" ? 35 : 37;

    graphics.fillStyle(0x1a1a1b, 1);
    graphics.fillEllipse(32, 24, 35, 31);
    graphics.fillRoundedRect(18, 31, 29, 23, 8);

    graphics.fillStyle(0xc94d3f, 1);
    graphics.fillTriangle(23 + capeOffset, 33, 10 + capeOffset, 55, 28 + capeOffset, 49);
    graphics.fillStyle(0xf06b58, 1);
    graphics.fillTriangle(26 + capeOffset, 34, 17 + capeOffset, 49, 30 + capeOffset, 46);

    graphics.fillStyle(0x73452b, 1);
    graphics.fillRoundedRect(19 + hairOffset, 9, 26, 15, 8);
    graphics.fillTriangle(23 + hairOffset, 10, 13 + hairOffset, 20, 24 + hairOffset, 23);
    graphics.fillTriangle(41 + hairOffset, 10, 51 + hairOffset, 20, 40 + hairOffset, 23);

    graphics.fillStyle(0xf6d6ba, 1);
    graphics.fillCircle(32, 24, 13);
    graphics.fillStyle(0xffb9a8, 0.8);
    graphics.fillCircle(24, 28, 3);
    graphics.fillCircle(40, 28, 3);
    graphics.lineStyle(2, 0x5b3322, 1);
    graphics.lineBetween(24, 19, 29, 18);
    graphics.lineBetween(35, 18, 40, 19);
    graphics.lineStyle(0, 0, 0);
    graphics.fillStyle(0x1a1a1b, 1);
    graphics.fillEllipse(27, 23, 5, 7);
    graphics.fillEllipse(37, 23, 5, 7);
    graphics.fillStyle(0xf6fbff, 1);
    graphics.fillCircle(26, 21, 1);
    graphics.fillCircle(36, 21, 1);
    graphics.fillStyle(0xd99079, 1);
    graphics.fillRoundedRect(31, 25, 2, 4, 1);
    graphics.fillStyle(0x8a3a33, 1);
    graphics.fillRoundedRect(29, 31, 7, 2, 1);

    graphics.fillStyle(0x7d8da3, 1);
    graphics.fillRoundedRect(18, 32, 28, 15, 6);
    graphics.fillStyle(0xd9e3ee, 1);
    graphics.fillRoundedRect(22, 30, 20, 16, 5);
    graphics.fillStyle(0xf6fbff, 1);
    graphics.fillRect(29, 31, 6, 14);
    graphics.fillStyle(0xffbf00, 1);
    graphics.fillRect(29, 43, 7, 4);

    graphics.fillStyle(0x425166, 1);
    graphics.fillRoundedRect(12, shieldY, 12, 17, 6);
    graphics.lineStyle(2, 0xe6edf7, 1);
    graphics.strokeRoundedRect(12, shieldY, 12, 17, 6);
    graphics.lineStyle(0, 0, 0);
    graphics.fillStyle(0xffbf00, 1);
    graphics.fillCircle(18, shieldY + 8, 3);

    graphics.fillStyle(0xe7edf5, 1);
    graphics.fillRect(47 + swordOffset, swordY, 4, 20);
    graphics.fillStyle(0xf6fbff, 1);
    graphics.fillTriangle(49 + swordOffset, swordTipY, 44 + swordOffset, swordY, 54 + swordOffset, swordY);
    graphics.fillStyle(0xd5a23a, 1);
    graphics.fillRect(45 + swordOffset, swordY + 18, 8, 3);
    graphics.fillStyle(0x7b5536, 1);
    graphics.fillRect(47 + swordOffset, swordY + 21, 4, 5);

    graphics.fillStyle(0x314158, 1);
    graphics.fillRoundedRect(leftLegX, 50, 6, 9, 2);
    graphics.fillRoundedRect(rightLegX, 50, 6, 9, 2);
    graphics.fillStyle(0x765841, 1);
    graphics.fillRoundedRect(leftLegX - 1, 58, 8, 3, 1);
    graphics.fillRoundedRect(rightLegX - 1, 58, 8, 3, 1);
  }

  function createMonsterTextures(scene) {
    // 레벨대별로 읽히는 동물 컨셉 3종을 만든다.
    const variants = [
      { type: "slime-rabbit", skin: 0x8fdc72, accent: 0xe8ffd6, blush: 0xffa9a9 },
      { type: "boar-pup", skin: 0xc8945c, accent: 0xffd9a3, blush: 0xffb89a },
      { type: "bat-cat", skin: 0x8f6cc8, accent: 0xf0d7ff, blush: 0xffb1d7 },
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
    // 공격/이동 상태에 따라 귀, 다리, 표정 위치를 바꾼다.
    const legOffset = pose === "move-a" ? -2 : pose === "move-b" ? 2 : 0;
    const armOffset = pose === "attack" ? 4 : pose === "move-a" ? 1 : 0;
    const eyeY = pose === "attack" ? 14 : 15;
    const mouthY = pose === "attack" ? 24 : 25;

    if (variant.type === "slime-rabbit") {
      graphics.fillStyle(0x1a1a1b, 1);
      graphics.fillEllipse(20, 23, 31, 27);
      graphics.fillRoundedRect(11, 6, 8, 20, 5);
      graphics.fillRoundedRect(22, 6, 8, 20, 5);
      graphics.fillStyle(variant.skin, 1);
      graphics.fillRoundedRect(12, 7 + legOffset, 7, 19, 5);
      graphics.fillRoundedRect(22, 7 - legOffset, 7, 19, 5);
      graphics.fillCircle(20, 22, 13);
      graphics.fillEllipse(20, 32, 24, 17);
      graphics.fillStyle(variant.accent, 1);
      graphics.fillEllipse(20, 31, 14, 9);
    } else if (variant.type === "boar-pup") {
      graphics.fillStyle(0x1a1a1b, 1);
      graphics.fillEllipse(20, 23, 35, 26);
      graphics.fillTriangle(10, 13, 5, 23, 15, 21);
      graphics.fillTriangle(30, 13, 35, 23, 25, 21);
      graphics.fillStyle(variant.skin, 1);
      graphics.fillEllipse(20, 24, 31, 24);
      graphics.fillTriangle(10, 14, 6, 22, 15, 20);
      graphics.fillTriangle(30, 14, 34, 22, 25, 20);
      graphics.fillStyle(variant.accent, 1);
      graphics.fillEllipse(20, 27, 14, 9);
      graphics.fillStyle(0x744b32, 1);
      graphics.fillRect(16, 26, 3, 2);
      graphics.fillRect(22, 26, 3, 2);
    } else {
      graphics.fillStyle(0x1a1a1b, 1);
      graphics.fillTriangle(7 + armOffset, 22, 0 + armOffset, 12, 3 + armOffset, 34);
      graphics.fillTriangle(33, 22, 40, 12, 37, 34);
      graphics.fillEllipse(20, 23, 30, 28);
      graphics.fillTriangle(11, 10, 7, 2, 18, 11);
      graphics.fillTriangle(29, 10, 33, 2, 22, 11);
      graphics.fillStyle(variant.skin, 1);
      graphics.fillTriangle(8 + armOffset, 22, 1 + armOffset, 14, 4 + armOffset, 32);
      graphics.fillTriangle(32, 22, 39, 14, 36, 32);
      graphics.fillCircle(20, 22, 13);
      graphics.fillStyle(variant.accent, 1);
      graphics.fillTriangle(11, 11, 8, 5, 17, 12);
      graphics.fillTriangle(29, 11, 32, 5, 23, 12);
    }

    graphics.fillStyle(0x1a1a1b, 1);
    graphics.fillRect(14, eyeY, 4, 4);
    graphics.fillRect(22, eyeY, 4, 4);
    graphics.fillStyle(variant.blush, 0.95);
    graphics.fillCircle(12, 22, 2);
    graphics.fillCircle(28, 22, 2);
    graphics.fillStyle(0x2d1010, 1);
    graphics.fillRoundedRect(17, mouthY, 6, 2, 1);

    graphics.fillStyle(variant.skin, 1);
    graphics.fillRoundedRect(10 + legOffset, 38, 7, 7, 3);
    graphics.fillRoundedRect(23 - legOffset, 38, 7, 7, 3);

    if (pose === "attack") {
      graphics.fillStyle(0xffd36e, 1);
      graphics.fillCircle(6, 24, 4);
    }
  }

  function createEffectTextures(scene) {
    // 전투 연출용 slash와 투사체 텍스처 생성.
    const slash = scene.make.graphics({ x: 0, y: 0, add: false });
    slash.fillStyle(0xf4e5b5, 1);
    slash.fillTriangle(28, 0, 56, 20, 0, 20);
    slash.generateTexture("slash", 56, 20);
    slash.destroy();

    const projectile = scene.make.graphics({ x: 0, y: 0, add: false });
    projectile.fillStyle(0x1a1a1b, 1);
    projectile.fillCircle(8, 8, 8);
    projectile.fillStyle(0xffbf00, 1);
    projectile.fillCircle(8, 8, 7);
    projectile.fillStyle(0xfffdd0, 1);
    projectile.fillCircle(8, 8, 3);
    projectile.generateTexture("enemy-shot", 16, 16);
    projectile.destroy();
  }

  function createBossTextures(scene) {
    ["idle", "move-a", "move-b", "attack"].forEach((pose) => {
      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      drawBossTexture(graphics, pose);
      graphics.generateTexture(`boss-${pose}`, 64, 72);
      graphics.destroy();
    });
  }

  function drawBossTexture(graphics, pose) {
    const legOffset = pose === "move-a" ? -2 : pose === "move-b" ? 2 : 0;
    const armOffset = pose === "attack" ? 5 : pose === "move-a" ? 2 : 0;
    const eyeY = pose === "attack" ? 18 : 20;

    graphics.fillStyle(0x1a1a1b, 1);
    graphics.fillRoundedRect(22, 44, 20, 20, 7);
    graphics.fillEllipse(32, 30, 48, 42);
    graphics.fillCircle(15, 33, 14);
    graphics.fillCircle(49, 33, 14);

    graphics.fillStyle(0x5f7f3a, 1);
    graphics.fillRoundedRect(27, 42, 10, 21, 4);
    graphics.fillStyle(0x8c6a42, 1);
    graphics.fillCircle(32, 28, 21);
    graphics.fillCircle(16, 34, 13);
    graphics.fillCircle(48, 34, 13);
    graphics.fillEllipse(32, 44, 34, 20);

    graphics.fillStyle(0x9bd47e, 1);
    graphics.fillTriangle(21, 13, 9, 6, 16, 21);
    graphics.fillTriangle(43, 13, 55, 6, 48, 21);
    graphics.fillStyle(0x5c8f45, 1);
    graphics.fillTriangle(21, 13, 14, 8, 17, 20);
    graphics.fillTriangle(43, 13, 50, 8, 47, 20);

    graphics.fillStyle(0xffbf00, 1);
    graphics.fillRect(23, 8, 18, 7);
    graphics.fillTriangle(23, 8, 18, 3, 25, 8);
    graphics.fillTriangle(32, 8, 32, 1, 36, 8);
    graphics.fillTriangle(41, 8, 46, 3, 39, 8);
    graphics.fillStyle(0xffe2ab, 1);
    graphics.fillRect(28, 10, 8, 2);

    graphics.fillStyle(0xffd9a3, 1);
    graphics.fillEllipse(32, 34, 22, 14);
    graphics.fillStyle(0x1a1a1b, 1);
    graphics.fillRect(23, eyeY, 5, 5);
    graphics.fillRect(36, eyeY, 5, 5);
    graphics.fillRect(28, 33, 3, 3);
    graphics.fillRect(34, 33, 3, 3);
    graphics.fillRoundedRect(28, 39, 8, 2, 1);

    graphics.fillStyle(0xa1d494, 1);
    graphics.fillRoundedRect(9 + armOffset, 38, 7, 12, 4);
    graphics.fillRoundedRect(48, 38, 7, 12, 4);

    if (pose === "attack") {
      graphics.fillStyle(0xffbf00, 1);
      graphics.fillCircle(8, 28, 6);
    }

    graphics.fillStyle(0x60452f, 1);
    graphics.fillRoundedRect(18 + legOffset, 51, 8, 10, 3);
    graphics.fillRoundedRect(38 - legOffset, 51, 8, 10, 3);
    graphics.fillStyle(0x7c5734, 1);
    graphics.fillRoundedRect(17 + legOffset, 59, 10, 4, 2);
    graphics.fillRoundedRect(37 - legOffset, 59, 10, 4, 2);
  }

  function createTerrainTextures(scene) {
    // 맵 장식물과 미니맵 랜드마크가 될 지형 텍스처 생성.
    createTreeTexture(scene);
    createBushTexture(scene);
    createRockTexture(scene);
    createPondTexture(scene);
    createFlowerTexture(scene);
  }

  function createTreeTexture(scene) {
    // 나무는 축소된 미니맵에서도 읽히도록 큰 덩어리 위주로 그린다.
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x4e311d, 1);
    graphics.fillRoundedRect(28, 54, 16, 30, 5);
    graphics.fillStyle(0x603c22, 1);
    graphics.fillRoundedRect(24, 58, 6, 22, 3);
    graphics.fillRoundedRect(42, 60, 6, 18, 3);

    graphics.fillStyle(0x1f5d2f, 1);
    graphics.fillCircle(36, 28, 22);
    graphics.fillStyle(0x2f7e3f, 1);
    graphics.fillCircle(22, 38, 16);
    graphics.fillCircle(50, 38, 16);
    graphics.fillCircle(36, 46, 18);
    graphics.fillStyle(0x59a552, 1);
    graphics.fillCircle(27, 26, 8);
    graphics.fillCircle(45, 24, 7);
    graphics.fillCircle(36, 40, 9);

    graphics.generateTexture("terrain-tree", 72, 88);
    graphics.destroy();
  }

  function createBushTexture(scene) {
    // 수풀은 여러 원을 겹쳐 잔디 덩어리 느낌만 준다.
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x245e2f, 1);
    graphics.fillCircle(18, 22, 14);
    graphics.fillCircle(34, 18, 16);
    graphics.fillCircle(50, 22, 14);
    graphics.fillCircle(34, 30, 16);
    graphics.fillStyle(0x3f8b43, 1);
    graphics.fillCircle(24, 22, 8);
    graphics.fillCircle(44, 20, 8);
    graphics.fillCircle(34, 30, 9);
    graphics.generateTexture("terrain-bush", 68, 44);
    graphics.destroy();
  }

  function createRockTexture(scene) {
    // 바위는 단순 타원으로 실루엣만 표현한다.
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x59635d, 1);
    graphics.fillEllipse(26, 20, 36, 24);
    graphics.fillEllipse(44, 24, 28, 18);
    graphics.fillStyle(0x8f9b91, 1);
    graphics.fillEllipse(22, 17, 10, 6);
    graphics.fillEllipse(41, 22, 9, 5);
    graphics.generateTexture("terrain-rock", 64, 40);
    graphics.destroy();
  }

  function createPondTexture(scene) {
    // 연못은 외곽색과 내부 물색을 분리해 형태가 잘 보이게 한다.
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x356447, 1);
    graphics.fillEllipse(52, 38, 96, 62);
    graphics.fillStyle(0x2b7fb2, 1);
    graphics.fillEllipse(52, 38, 80, 48);
    graphics.fillStyle(0x7ed8ef, 0.9);
    graphics.fillEllipse(40, 31, 22, 10);
    graphics.fillEllipse(62, 44, 18, 8);
    graphics.generateTexture("terrain-pond", 104, 76);
    graphics.destroy();
  }

  function createFlowerTexture(scene) {
    // 꽃은 랜덤 배치용 작은 포인트 장식.
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    graphics.fillStyle(0x31743b, 1);
    graphics.fillRect(15, 18, 2, 10);
    graphics.fillRect(22, 16, 2, 12);
    graphics.fillRect(29, 19, 2, 9);
    graphics.fillStyle(0xf7e08b, 1);
    graphics.fillCircle(16, 17, 4);
    graphics.fillStyle(0xffd0d6, 1);
    graphics.fillCircle(23, 15, 4);
    graphics.fillStyle(0xbddf7d, 1);
    graphics.fillCircle(30, 18, 4);
    graphics.generateTexture("terrain-flower", 46, 30);
    graphics.destroy();
  }

  global.DungeonTextures = {
    // Scene에서 사용할 공개 진입점.
    createTextures,
  };
})(window);
