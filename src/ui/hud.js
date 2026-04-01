// HUD와 미니맵 프레임을 생성하고 갱신한다.
(function attachHudFactory(global) {
  function createHud(scene) {
    const hud = {};
    hud.container = scene.add.container(18, 18).setScrollFactor(0).setDepth(1000);

    hud.panel = scene.add.graphics();
    hud.panel.fillStyle(0x081015, 0.9);
    hud.panel.lineStyle(1, 0x365261, 0.95);
    hud.panel.fillRoundedRect(0, 0, 332, 176, 18);
    hud.panel.strokeRoundedRect(0, 0, 332, 176, 18);

    hud.classText = scene.add.text(16, 14, "전사", {
      fontFamily: "Segoe UI",
      fontSize: "24px",
      color: "#f3f1e8",
      fontStyle: "700",
    });
    hud.weaponText = scene.add.text(16, 42, "무기: 기본 자동 베기", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#aeb4bb",
    });
    hud.attackTierText = scene.add.text(16, 60, "공격 속도 1 / 10", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#d9b65b",
    });
    hud.hpLabel = scene.add.text(16, 86, "", {
      fontFamily: "Segoe UI",
      fontSize: "12px",
      color: "#ffd4ca",
    });
    hud.hpBar = scene.add.graphics();
    hud.mpLabel = scene.add.text(16, 114, "", {
      fontFamily: "Segoe UI",
      fontSize: "12px",
      color: "#c6deff",
    });
    hud.mpBar = scene.add.graphics();
    hud.xpLabel = scene.add.text(16, 142, "", {
      fontFamily: "Segoe UI",
      fontSize: "12px",
      color: "#d8e8ff",
    });
    hud.xpBar = scene.add.graphics();

    hud.roomText = scene.add.text(356, 16, "", {
      fontFamily: "Segoe UI",
      fontSize: "15px",
      color: "#d59f52",
      fontStyle: "700",
    }).setScrollFactor(0).setDepth(1000);

    hud.miniMapFrame = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    hud.miniMapFrame.fillStyle(0x081015, 0.86);
    hud.miniMapFrame.lineStyle(1, 0x365261, 1);
    hud.miniMapFrame.fillRoundedRect(1008, 16, 248, 158, 18);
    hud.miniMapFrame.strokeRoundedRect(1008, 16, 248, 158, 18);

    hud.miniMapTitle = scene.add.text(1024, 28, "MINIMAP", {
      fontFamily: "Segoe UI",
      fontSize: "12px",
      color: "#9fc4d0",
    }).setScrollFactor(0).setDepth(1002);

    hud.container.add([
      hud.panel,
      hud.classText,
      hud.weaponText,
      hud.attackTierText,
      hud.hpLabel,
      hud.hpBar,
      hud.mpLabel,
      hud.mpBar,
      hud.xpLabel,
      hud.xpBar,
    ]);

    return hud;
  }

  function refreshHud(scene, hud) {
    const config = global.DungeonConfig;
    const state = scene.playerState;
    const hpRatio = Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1);
    const mpRatio = Phaser.Math.Clamp(state.mp / state.maxMp, 0, 1);
    const xpRatio = Phaser.Math.Clamp(state.xp / state.xpToNext, 0, 1);

    hud.classText.setText(config.player.classLabel);
    hud.weaponText.setText(`무기: ${config.player.weapon}`);
    hud.attackTierText.setText(
      `공격 속도 ${config.player.attackRateTier} / ${config.player.attackRateMaxTier}`
    );
    hud.hpLabel.setText(`HP ${Math.ceil(state.hp)} / ${state.maxHp}`);
    hud.mpLabel.setText(`MP ${Math.ceil(state.mp)} / ${state.maxMp}`);
    hud.xpLabel.setText(`LV ${state.level} | EXP ${state.xp} / ${state.xpToNext}`);
    hud.roomText.setText(
      `ROOM ${String(config.room.number).padStart(2, "0")} | ${config.room.label}`
    );
    scene.roomLabel.setText(`ROOM ${String(config.room.number).padStart(2, "0")}`);

    drawBar(hud.hpBar, 110, 87, 194, hpRatio, 0x261311, 0xcf6a5a);
    drawBar(hud.mpBar, 110, 115, 194, mpRatio, 0x112339, 0x5ea9ff);
    drawBar(hud.xpBar, 110, 143, 194, xpRatio, 0x182432, 0x79d0ff);
  }

  function drawBar(graphics, x, y, width, ratio, bgColor, fillColor) {
    graphics.clear();
    graphics.fillStyle(bgColor, 1);
    graphics.fillRoundedRect(x, y, width, 12, 6);
    graphics.fillStyle(fillColor, 1);
    graphics.fillRoundedRect(x, y, width * ratio, 12, 6);
  }

  function getHudElementsToIgnore(hud) {
    return [
      hud.container,
      hud.panel,
      hud.classText,
      hud.weaponText,
      hud.attackTierText,
      hud.hpLabel,
      hud.hpBar,
      hud.mpLabel,
      hud.mpBar,
      hud.xpLabel,
      hud.xpBar,
      hud.roomText,
      hud.miniMapFrame,
      hud.miniMapTitle,
    ];
  }

  global.DungeonHud = {
    createHud,
    refreshHud,
    getHudElementsToIgnore,
  };
})(window);
