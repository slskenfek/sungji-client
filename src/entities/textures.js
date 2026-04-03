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
    // 동일한 바디 구조에 색상만 다른 3개 변종을 만든다.
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
    // 공격/이동 상태에 따라 팔, 다리, 표정 위치를 바꾼다.
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
    // 전투 연출용 slash와 투사체 텍스처 생성.
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

    graphics.fillStyle(0x56331f, 1);
    graphics.fillRoundedRect(26, 44, 12, 20, 4);

    graphics.fillStyle(0x304d1f, 1);
    graphics.fillCircle(32, 26, 20);
    graphics.fillStyle(0x4f7f31, 1);
    graphics.fillCircle(18, 32, 14);
    graphics.fillCircle(46, 32, 14);
    graphics.fillCircle(32, 42, 14);

    graphics.fillStyle(0xa56d2a, 1);
    graphics.fillRect(22, 8, 20, 6);
    graphics.fillTriangle(22, 14, 16, 20, 26, 17);
    graphics.fillTriangle(42, 14, 48, 20, 38, 17);
    graphics.fillStyle(0xf1db86, 1);
    graphics.fillRect(28, 10, 8, 3);

    graphics.fillStyle(0x8fcf68, 1);
    graphics.fillRoundedRect(16, 34, 32, 18, 8);
    graphics.fillStyle(0xeef7c0, 1);
    graphics.fillRect(22, eyeY, 5, 4);
    graphics.fillRect(37, eyeY, 5, 4);
    graphics.fillStyle(0x35180d, 1);
    graphics.fillRect(28, 28, 8, 3);
    graphics.fillStyle(0xbfe38d, 1);
    graphics.fillRect(10 + armOffset, 37, 5, 12);
    graphics.fillRect(49, 37, 5, 12);

    if (pose === "attack") {
      graphics.fillStyle(0xffb86d, 1);
      graphics.fillCircle(8, 28, 6);
    }

    graphics.fillStyle(0x4b331f, 1);
    graphics.fillRect(18 + legOffset, 50, 7, 10);
    graphics.fillRect(39 - legOffset, 50, 7, 10);
    graphics.fillStyle(0x7c5734, 1);
    graphics.fillRect(17 + legOffset, 59, 9, 4);
    graphics.fillRect(38 - legOffset, 59, 9, 4);
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
