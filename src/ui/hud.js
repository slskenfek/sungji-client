// HUD와 미니맵 프레임을 생성하고 갱신한다.
(function attachHudFactory(global) {
  function createHud(scene) {
    const hud = {};
    hud.container = scene.add.container(18, 18).setScrollFactor(0).setDepth(1000);

    hud.panel = scene.add.graphics();
    hud.panel.fillStyle(0x081015, 0.9);
    hud.panel.lineStyle(1, 0x365261, 0.95);
    hud.panel.fillRoundedRect(0, 0, 332, 274, 18);
    hud.panel.strokeRoundedRect(0, 0, 332, 274, 18);

    hud.titleText = scene.add.text(16, 14, "능력치", {
      fontFamily: "Segoe UI",
      fontSize: "24px",
      color: "#f3f1e8",
      fontStyle: "700",
    });
    hud.classText = scene.add.text(16, 48, "", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#d8e8ff",
    });
    hud.attackTierText = scene.add.text(16, 70, "", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#d9b65b",
    });
    hud.attackSpeedText = scene.add.text(16, 92, "", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#f4d08a",
    });
    hud.damageText = scene.add.text(16, 114, "", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#ffb38f",
    });
    hud.strengthText = scene.add.text(16, 136, "", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#ffd9b3",
    });
    hud.dexterityText = scene.add.text(16, 158, "", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#bfe6a8",
    });
    hud.knowledgeText = scene.add.text(16, 180, "", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#b8d7ff",
    });
    hud.defenseText = scene.add.text(16, 202, "", {
      fontFamily: "Segoe UI",
      fontSize: "13px",
      color: "#ffc7c7",
    });
    hud.hpLabel = scene.add.text(16, 226, "", {
      fontFamily: "Segoe UI",
      fontSize: "12px",
      color: "#ffd4ca",
    });
    hud.hpBar = scene.add.graphics();
    hud.mpLabel = scene.add.text(16, 248, "", {
      fontFamily: "Segoe UI",
      fontSize: "12px",
      color: "#c6deff",
    });
    hud.mpBar = scene.add.graphics();
    hud.xpLabel = scene.add.text(16, 270, "", {
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
      hud.titleText,
      hud.classText,
      hud.attackTierText,
      hud.attackSpeedText,
      hud.damageText,
      hud.strengthText,
      hud.dexterityText,
      hud.knowledgeText,
      hud.defenseText,
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

    hud.titleText.setText("능력치");
    hud.classText.setText(`직업: ${config.player.classLabel}`);
    hud.attackTierText.setText(`공속 단계: ${formatStat(state.attackRateStage)}`);
    hud.attackSpeedText.setText(`공격속도: ${formatStat(state.attackSpeed)}`);
    hud.damageText.setText(`데미지: ${formatStat(state.damage)}`);
    hud.strengthText.setText(`힘: ${formatStat(state.strength)}`);
    hud.dexterityText.setText(`덱스: ${formatStat(state.dexterity)}`);
    hud.knowledgeText.setText(`지식: ${formatStat(state.knowledge)}`);
    hud.defenseText.setText(`방어: ${formatStat(state.defense)}`);
    hud.hpLabel.setText(`HP ${Math.ceil(state.hp)} / ${state.maxHp}`);
    hud.mpLabel.setText(`MP ${Math.ceil(state.mp)} / ${state.maxMp}`);
    hud.xpLabel.setText(`LV:${state.level} | EXP ${state.xp} / ${state.xpToNext}`);
    hud.roomText.setText(
      `ROOM ${String(config.room.number).padStart(2, "0")} | ${config.room.label}`
    );
    scene.roomLabel.setText(`ROOM ${String(config.room.number).padStart(2, "0")}`);

    drawBar(hud.hpBar, 110, 227, 194, hpRatio, 0x261311, 0xcf6a5a);
    drawBar(hud.mpBar, 110, 249, 194, mpRatio, 0x112339, 0x5ea9ff);
    drawBar(hud.xpBar, 110, 271, 194, xpRatio, 0x182432, 0x79d0ff);
    refreshStatsPanel(config, state);
  }

  function drawBar(graphics, x, y, width, ratio, bgColor, fillColor) {
    graphics.clear();
    graphics.fillStyle(bgColor, 1);
    graphics.fillRoundedRect(x, y, width, 12, 6);
    graphics.fillStyle(fillColor, 1);
    graphics.fillRoundedRect(x, y, width * ratio, 12, 6);
  }

  function formatStat(value) {
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }

  function refreshStatsPanel(config, state) {
    setPanelText("stat-class", config.player.classLabel);
    setPanelText("stat-attack-tier", formatStat(state.attackRateStage));
    setPanelText("stat-attack-speed", formatStat(state.attackSpeed));
    setPanelText("stat-damage", formatStat(state.damage));
    setPanelText("stat-strength", formatStat(state.strength));
    setPanelText("stat-dexterity", formatStat(state.dexterity));
    setPanelText("stat-knowledge", formatStat(state.knowledge));
    setPanelText("stat-defense", formatStat(state.defense));
  }

  function setPanelText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function getHudElementsToIgnore(hud) {
    return [
      hud.container,
      hud.panel,
      hud.titleText,
      hud.classText,
      hud.attackTierText,
      hud.attackSpeedText,
      hud.damageText,
      hud.strengthText,
      hud.dexterityText,
      hud.knowledgeText,
      hud.defenseText,
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
