// HUD와 미니맵 프레임을 생성하고 갱신한다.
// 플레이어 상태를 화면 텍스트/막대/UI 프레임으로 변환하는 모듈이다.
(function attachHudFactory(global) {
  function createHud(scene) {
    // Scene이 들고 있을 UI 오브젝트 묶음.
    const hud = {};
    // ScrollFactor 0은 카메라 이동과 무관하게 화면에 고정된다는 뜻이다.
    hud.container = scene.add.container(24, 24).setScrollFactor(0).setDepth(1000);

    // 좌측 상태 패널 배경.
    hud.panel = scene.add.graphics();
    hud.panel.fillStyle(0x031427, 0.88);
    hud.panel.fillRoundedRect(0, 0, 344, 270, 12);
    hud.panel.fillStyle(0x102034, 0.82);
    hud.panel.fillRoundedRect(4, 4, 336, 262, 10);
    hud.panel.lineStyle(2, 0xf2ca50, 0.42);
    hud.panel.strokeRoundedRect(4, 4, 336, 262, 10);
    hud.panel.fillStyle(0xf2ca50, 0.16);
    hud.panel.fillRoundedRect(14, 14, 126, 30, 8);
    hud.panel.fillStyle(0x8c6a42, 0.34);
    hud.panel.fillCircle(286, 52, 34);
    hud.panel.fillStyle(0xd9e3ee, 1);
    hud.panel.fillRoundedRect(262, 42, 48, 28, 10);
    hud.panel.fillStyle(0xc94d3f, 1);
    hud.panel.fillTriangle(271, 58, 256, 83, 286, 67);
    hud.panel.fillStyle(0xf6d6ba, 1);
    hud.panel.fillCircle(286, 37, 16);
    hud.panel.fillStyle(0x73452b, 1);
    hud.panel.fillRoundedRect(270, 22, 32, 14, 8);

    // 실제 값은 나중에 refreshHud()에서 주입된다.
    hud.titleText = scene.add.text(16, 14, "능력치", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "18px",
      color: "#f2ca50",
      fontStyle: "800",
    });
    hud.classText = scene.add.text(16, 48, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "13px",
      color: "#d3e4fe",
    });
    hud.attackTierText = scene.add.text(16, 70, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "13px",
      color: "#d9b65b",
    });
    hud.attackSpeedText = scene.add.text(16, 92, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "13px",
      color: "#f4d08a",
    });
    hud.damageText = scene.add.text(16, 114, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "13px",
      color: "#ffb38f",
    });
    hud.strengthText = scene.add.text(16, 136, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "13px",
      color: "#ffd9b3",
    });
    hud.dexterityText = scene.add.text(16, 158, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "13px",
      color: "#bfe6a8",
    });
    hud.knowledgeText = scene.add.text(16, 180, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "13px",
      color: "#b8d7ff",
    });
    hud.defenseText = scene.add.text(16, 202, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "13px",
      color: "#ffc7c7",
    });
    hud.hpLabel = scene.add.text(16, 226, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "12px",
      color: "#ffb3ae",
      fontStyle: "700",
    });
    hud.hpBar = scene.add.graphics();
    hud.xpLabel = scene.add.text(16, 248, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "12px",
      color: "#b8d7ff",
      fontStyle: "700",
    });
    hud.xpBar = scene.add.graphics();

    // roomText와 minimap 프레임은 화면 절대좌표 기준으로 따로 배치한다.
    hud.roomText = scene.add.text(356, 16, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "15px",
      color: "#f2ca50",
      fontStyle: "800",
      stroke: "#1a1a1b",
      strokeThickness: 4,
    }).setScrollFactor(0).setDepth(1000);

    hud.clockPanel = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    hud.clockPanel.fillStyle(0x031427, 0.88);
    hud.clockPanel.fillRoundedRect(556, 20, 168, 58, 12);
    hud.clockPanel.fillStyle(0xf2ca50, 0.18);
    hud.clockPanel.fillRoundedRect(562, 26, 156, 46, 9);
    hud.clockPanel.lineStyle(2, 0xf2ca50, 0.58);
    hud.clockPanel.strokeRoundedRect(562, 26, 156, 46, 9);

    hud.clockText = scene.add.text(1132, 96, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "26px",
      color: "#d3e4fe",
      fontStyle: "800",
      stroke: "#1a1a1b",
      strokeThickness: 4,
    }).setOrigin(0.5).setPosition(640, 49).setScrollFactor(0).setDepth(1003);

    // 미니맵 카메라가 보이는 영역 위를 감싸는 프레임.
    hud.miniMapFrame = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    hud.miniMapFrame.fillStyle(0x031427, 0.9);
    hud.miniMapFrame.fillRoundedRect(1008, 16, 248, 158, 12);
    hud.miniMapFrame.fillStyle(0x102034, 0.9);
    hud.miniMapFrame.fillRoundedRect(1014, 22, 236, 146, 10);
    hud.miniMapFrame.lineStyle(2, 0xf2ca50, 0.72);
    hud.miniMapFrame.strokeRoundedRect(1014, 22, 236, 146, 10);
    hud.miniMapFrame.fillStyle(0x34592d, 0.95);
    hud.miniMapFrame.fillRoundedRect(1019, 47, 226, 116, 8);
    hud.miniMapFrame.lineStyle(1, 0xa1d494, 0.75);
    hud.miniMapFrame.strokeRoundedRect(1019, 47, 226, 116, 8);
    hud.miniMapFrame.fillStyle(0x7fb05e, 0.14);
    for (let i = 0; i < 10; i += 1) {
      hud.miniMapFrame.fillCircle(1032 + i * 22, 58 + (i % 2) * 10, 8);
      hud.miniMapFrame.fillCircle(1042 + i * 20, 156 - (i % 3) * 8, 7);
    }

    hud.miniMapTitle = scene.add.text(1024, 28, "MINIMAP", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "12px",
      color: "#f2ca50",
      fontStyle: "800",
    }).setScrollFactor(0).setDepth(1002);

    hud.skillBar = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    hud.skillBar.fillStyle(0x031427, 0.86);
    hud.skillBar.fillRoundedRect(412, 626, 456, 70, 12);
    hud.skillBar.fillStyle(0x102034, 0.86);
    hud.skillBar.fillRoundedRect(418, 632, 444, 58, 10);
    hud.skillBar.lineStyle(2, 0xf2ca50, 0.35);
    hud.skillBar.strokeRoundedRect(418, 632, 444, 58, 10);
    hud.skillTexts = ["Q", "W", "E", "R", "CTRL"].map((key, index) => {
      const x = 454 + index * 78;
      const width = key === "CTRL" ? 70 : 52;
      hud.skillBar.fillStyle(index === 4 ? 0xf2ca50 : 0x0b1c30, index === 4 ? 0.9 : 1);
      hud.skillBar.fillRoundedRect(x, 641, width, 40, 8);
      hud.skillBar.lineStyle(2, 0x1a1a1b, 1);
      hud.skillBar.strokeRoundedRect(x, 641, width, 40, 8);
      return scene.add.text(x + width / 2, 661, key, {
        fontFamily: "Plus Jakarta Sans, Segoe UI",
        fontSize: key === "CTRL" ? "14px" : "16px",
        color: index === 4 ? "#241a00" : "#d3e4fe",
        fontStyle: "800",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    });
    hud.skillCooldownText = scene.add.text(788, 686, "", {
      fontFamily: "Plus Jakarta Sans, Segoe UI",
      fontSize: "11px",
      color: "#b8d7ff",
      fontStyle: "800",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);

    // 왼쪽 패널 요소는 container로 한 번에 관리한다.
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
      hud.xpLabel,
      hud.xpBar,
    ]);

    return hud;
  }

  function refreshHud(scene, hud) {
    const config = global.DungeonConfig;
    const state = scene.playerState;
    const skillProfile = scene.getSkillProfile();
    const effectiveAttackSpeed = scene.getEffectiveAttackRateStage();
    // 상태 비율은 progress bar 길이 계산에 사용한다.
    const hpRatio = Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1);
    const xpRatio = Phaser.Math.Clamp(state.xp / state.xpToNext, 0, 1);

    // Scene의 현재 상태 스냅샷(playerState)을 실제 표시용 문자열로 바꾼다.
    hud.titleText.setText("능력치");
    hud.classText.setText(`${config.player.classLabel} | LV ${state.level}`);
    hud.attackTierText.setText(`공속 단계: ${formatStat(state.attackRateStage)}`);
    hud.attackSpeedText.setText(`공격속도: ${formatStat(effectiveAttackSpeed)}`);
    hud.damageText.setText(`데미지: ${formatStat(state.damage)}`);
    hud.strengthText.setText(`힘: ${formatStat(state.strength)}`);
    hud.dexterityText.setText(`덱스: ${formatStat(state.dexterity)}`);
    hud.knowledgeText.setText(`지식: ${formatStat(state.knowledge)}`);
    hud.defenseText.setText(`방어: ${formatStat(state.defense)}`);
    hud.hpLabel.setText(`HP ${Math.ceil(state.hp)} / ${state.maxHp}`);
    hud.xpLabel.setText(
      `LV:${state.level} | EXP ${state.xp} / ${state.xpToNext} | ${skillProfile.name} ${scene.getSkillStatusText()}`
    );
    hud.roomText.setText(
      `STAGE ${String(scene.getStageNumber()).padStart(2, "0")} | ${config.stage.label} | ${scene.getStageStatusText()}`
    );
    hud.clockText.setText(scene.getClockText());
    hud.clockText.setColor(scene.bossSpawned ? "#ffb3ae" : "#fffdd0");
    hud.skillCooldownText.setText(`CTRL ${skillProfile.name} ${scene.getSkillStatusText()}`);
    scene.roomLabel.setText(scene.getStageWorldLabel());

    drawBar(hud.hpBar, 110, 227, 194, hpRatio, 0x1a1a1b, 0xff6d62);
    drawBar(hud.xpBar, 110, 249, 194, xpRatio, 0x1a1a1b, 0x79d0ff);
    refreshStatsPanel(config, state, effectiveAttackSpeed);
  }

  function drawBar(graphics, x, y, width, ratio, bgColor, fillColor) {
    // 기존 막대를 지우고 다시 그리는 방식으로 업데이트한다.
    graphics.clear();
    graphics.fillStyle(bgColor, 1);
    graphics.fillRoundedRect(x, y, width, 12, 6);
    graphics.fillStyle(fillColor, 1);
    graphics.fillRoundedRect(x, y, width * ratio, 12, 6);
    graphics.lineStyle(1, 0xffe2ab, 0.45);
    graphics.strokeRoundedRect(x, y, width, 12, 6);
  }

  function formatStat(value) {
    // 정수/실수 표시 형식을 통일해 HUD 가독성을 높인다.
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }

  function refreshStatsPanel(config, state, effectiveAttackSpeed) {
    // 캔버스 HUD 외에 HTML 패널에도 같은 값을 동기화한다.
    setPanelText("stat-class", config.player.classLabel);
    setPanelText("stat-level", state.level);
    setPanelText("stat-attack-tier", formatStat(state.attackRateStage));
    setPanelText("stat-attack-speed", formatStat(effectiveAttackSpeed));
    setPanelText("stat-damage", formatStat(state.damage));
    setPanelText("stat-strength", formatStat(state.strength));
    setPanelText("stat-dexterity", formatStat(state.dexterity));
    setPanelText("stat-knowledge", formatStat(state.knowledge));
    setPanelText("stat-defense", formatStat(state.defense));
  }

  function setPanelText(id, value) {
    // HTML이 없는 경우에도 안전하게 지나가도록 null 체크.
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function getHudElementsToIgnore(hud) {
    // 미니맵 카메라가 HUD를 다시 찍지 않도록 제외 목록을 넘긴다.
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
      hud.xpLabel,
      hud.xpBar,
      hud.roomText,
      hud.clockPanel,
      hud.clockText,
      hud.miniMapFrame,
      hud.miniMapTitle,
      hud.skillBar,
      hud.skillCooldownText,
      ...hud.skillTexts,
    ];
  }

  global.DungeonHud = {
    // Scene이 호출할 공개 API.
    createHud,
    refreshHud,
    getHudElementsToIgnore,
  };
})(window);
