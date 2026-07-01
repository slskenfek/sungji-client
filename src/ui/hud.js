// HUD와 미니맵 프레임을 생성하고 갱신한다.
// 플레이어 상태를 화면 텍스트/막대/UI 프레임으로 변환하는 모듈이다.
(function attachHudFactory(global) {
  const panelElements = new Map();

  function createHud(scene) {
    // Scene이 들고 있을 UI 오브젝트 묶음.
    const hud = {};

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

    return hud;
  }

  function refreshHud(scene, hud) {
    const config = global.DungeonConfig;
    const state = scene.playerState;
    const effectiveAttackSpeed = scene.getEffectiveAttackRateStage();
    // 상태 비율은 progress bar 길이 계산에 사용한다.
    const hpRatio = Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1);
    const xpRatio = Phaser.Math.Clamp(state.xp / state.xpToNext, 0, 1);

    const classLabel = scene.getPlayerClassLabel();
    setGameText(
      hud.roomText,
      `STAGE ${String(scene.getStageNumber()).padStart(2, "0")} | ${config.stage.label} | ${scene.getStageStatusText()}`
    );
    setGameText(hud.clockText, scene.getClockText());
    const clockColor = scene.bossSpawned ? "#ffb3ae" : "#fffdd0";
    if (hud.clockText.style.color !== clockColor) {
      hud.clockText.setColor(clockColor);
    }
    setGameText(scene.roomLabel, scene.getStageWorldLabel());

    refreshStatsPanel(
      config,
      state,
      effectiveAttackSpeed,
      classLabel,
      scene.getSupremeEquipmentProgress()
    );
    refreshExternalPlayerStatus(scene, state, hpRatio, xpRatio);
  }

  function refreshStatusCounter(scene) {
    const state = scene.playerState;
    refreshExternalPlayerStatus(
      scene,
      state,
      Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1),
      Phaser.Math.Clamp(state.xp / state.xpToNext, 0, 1)
    );
  }

  function refreshExternalPlayerStatus(scene, state, hpRatio, xpRatio) {
    setPanelText("player-hp-text", `${Math.ceil(state.hp)} / ${state.maxHp}`);
    setPanelText("player-xp-text", `${state.xp} / ${state.xpToNext}`);
    const skillReady = scene.time.now >= scene.skillCooldownUntil;
    const remainingSeconds = Math.max(1, Math.ceil((scene.skillCooldownUntil - scene.time.now) / 1000));
    setPanelText("player-skill-status", skillReady ? "사용 가능" : remainingSeconds);
    setSkillCounterState(skillReady);
    setPanelBar("player-hp-bar", hpRatio);
    setPanelBar("player-xp-bar", xpRatio);
  }

  function setSkillCounterState(ready) {
    const element = getPanelElement("skill-counter");
    if (!element) {
      return;
    }
    if (element.classList.contains("ready") !== ready) {
      element.classList.toggle("ready", ready);
      element.classList.toggle("cooldown", !ready);
    }
  }

  function setPanelBar(id, ratio) {
    const element = getPanelElement(id);
    if (element) {
      const width = `${Phaser.Math.Clamp(ratio, 0, 1) * 100}%`;
      if (element.style.width !== width) {
        element.style.width = width;
      }
    }
  }

  function setGameText(textObject, value) {
    if (textObject.text !== value) {
      textObject.setText(value);
    }
  }

  function formatStat(value) {
    // 정수/실수 표시 형식을 통일해 HUD 가독성을 높인다.
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }

  function refreshStatsPanel(config, state, effectiveAttackSpeed, classLabel, supremeEquipmentProgress) {
    // 캔버스 HUD 외에 HTML 패널에도 같은 값을 동기화한다.
    setPanelText("stat-class", classLabel);
    setPanelText("character-class", classLabel);
    setPanelText("stat-level", state.level);
    setPanelText("stat-attack-tier", formatStat(state.attackRateStage));
    setPanelText("stat-attack-speed", formatStat(effectiveAttackSpeed));
    setPanelText("stat-damage", formatStat(state.damage));
    setPanelText("stat-strength", formatStat(state.strength));
    setPanelText("stat-dexterity", formatStat(state.dexterity));
    setPanelText("stat-knowledge", formatStat(state.knowledge));
    setPanelText("stat-defense", formatStat(state.defense));
    const supremeEffectCount = Math.round(supremeEquipmentProgress * 4);
    setPanelText(
      "stat-awakening",
      `${state.isAwakened ? "각성 완료" : "미각성"} · 권능 ${supremeEffectCount}/4`
    );
  }

  function setPanelText(id, value) {
    const element = getPanelElement(id);
    const nextValue = String(value);
    if (element && element.textContent !== nextValue) {
      element.textContent = nextValue;
    }
  }

  function getPanelElement(id) {
    if (!panelElements.has(id)) {
      panelElements.set(id, document.getElementById(id));
    }
    return panelElements.get(id);
  }

  function getHudElementsToIgnore(hud) {
    // 미니맵 카메라가 HUD를 다시 찍지 않도록 제외 목록을 넘긴다.
    return [
      hud.roomText,
      hud.clockPanel,
      hud.clockText,
      hud.miniMapFrame,
      hud.miniMapTitle,
    ];
  }

  global.DungeonHud = {
    // Scene이 호출할 공개 API.
    createHud,
    refreshHud,
    refreshStatusCounter,
    getHudElementsToIgnore,
  };
})(window);
