// HUD와 미니맵 프레임을 생성하고 갱신한다.
// 플레이어 상태를 화면 텍스트/막대/UI 프레임으로 변환하는 모듈이다.
(function attachHudFactory(global) {
  function createHud(scene) {
    // Scene이 들고 있을 UI 오브젝트 묶음.
    const hud = {};
    // ScrollFactor 0은 카메라 이동과 무관하게 화면에 고정된다는 뜻이다.
    hud.container = scene.add.container(18, 18).setScrollFactor(0).setDepth(1000);

    // 좌측 상태 패널 배경.
    hud.panel = scene.add.graphics();
    hud.panel.fillStyle(0x081015, 0.9);
    hud.panel.lineStyle(1, 0x365261, 0.95);
    hud.panel.fillRoundedRect(0, 0, 332, 252, 18);
    hud.panel.strokeRoundedRect(0, 0, 332, 252, 18);

    // 실제 값은 나중에 refreshHud()에서 주입된다.
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
    hud.xpLabel = scene.add.text(16, 248, "", {
      fontFamily: "Segoe UI",
      fontSize: "12px",
      color: "#d8e8ff",
    });
    hud.xpBar = scene.add.graphics();

    // roomText와 minimap 프레임은 화면 절대좌표 기준으로 따로 배치한다.
    hud.roomText = scene.add.text(356, 16, "", {
      fontFamily: "Segoe UI",
      fontSize: "15px",
      color: "#dcbc71",
      fontStyle: "700",
    }).setScrollFactor(0).setDepth(1000);

    hud.clockText = scene.add.text(1132, 96, "", {
      fontFamily: "Segoe UI",
      fontSize: "20px",
      color: "#f3efc1",
      fontStyle: "700",
      stroke: "#31491d",
      strokeThickness: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1003);

    // 미니맵 카메라가 보이는 영역 위를 감싸는 프레임.
    hud.miniMapFrame = scene.add.graphics().setScrollFactor(0).setDepth(1001);
    hud.miniMapFrame.fillStyle(0x102012, 0.9);
    hud.miniMapFrame.lineStyle(2, 0x7c663c, 1);
    hud.miniMapFrame.fillRoundedRect(1008, 16, 248, 158, 18);
    hud.miniMapFrame.strokeRoundedRect(1008, 16, 248, 158, 18);
    hud.miniMapFrame.fillStyle(0x34592d, 0.95);
    hud.miniMapFrame.fillRoundedRect(1018, 46, 228, 118, 14);
    hud.miniMapFrame.lineStyle(1, 0xbca36a, 0.75);
    hud.miniMapFrame.strokeRoundedRect(1018, 46, 228, 118, 14);
    hud.miniMapFrame.fillStyle(0x7fb05e, 0.14);
    for (let i = 0; i < 10; i += 1) {
      hud.miniMapFrame.fillCircle(1032 + i * 22, 58 + (i % 2) * 10, 8);
      hud.miniMapFrame.fillCircle(1042 + i * 20, 156 - (i % 3) * 8, 7);
    }

    hud.miniMapTitle = scene.add.text(1024, 28, "MINIMAP", {
      fontFamily: "Segoe UI",
      fontSize: "12px",
      color: "#dce8b2",
      fontStyle: "700",
    }).setScrollFactor(0).setDepth(1002);

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
    // 상태 비율은 progress bar 길이 계산에 사용한다.
    const hpRatio = Phaser.Math.Clamp(state.hp / state.maxHp, 0, 1);
    const xpRatio = Phaser.Math.Clamp(state.xp / state.xpToNext, 0, 1);

    // Scene의 현재 상태 스냅샷(playerState)을 실제 표시용 문자열로 바꾼다.
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
    hud.xpLabel.setText(
      `LV:${state.level} | EXP ${state.xp} / ${state.xpToNext} | CTRL ${scene.getSkillStatusText()}`
    );
    hud.roomText.setText(
      `STAGE ${String(config.stage.number).padStart(2, "0")} | ${config.stage.label} | ${scene.getStageStatusText()}`
    );
    hud.clockText.setText(scene.getClockText());
    scene.roomLabel.setText(scene.getStageWorldLabel());

    drawBar(hud.hpBar, 110, 227, 194, hpRatio, 0x261311, 0xcf6a5a);
    drawBar(hud.xpBar, 110, 249, 194, xpRatio, 0x182432, 0x79d0ff);
    refreshStatsPanel(config, state);
  }

  function drawBar(graphics, x, y, width, ratio, bgColor, fillColor) {
    // 기존 막대를 지우고 다시 그리는 방식으로 업데이트한다.
    graphics.clear();
    graphics.fillStyle(bgColor, 1);
    graphics.fillRoundedRect(x, y, width, 12, 6);
    graphics.fillStyle(fillColor, 1);
    graphics.fillRoundedRect(x, y, width * ratio, 12, 6);
  }

  function formatStat(value) {
    // 정수/실수 표시 형식을 통일해 HUD 가독성을 높인다.
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }

  function refreshStatsPanel(config, state) {
    // 캔버스 HUD 외에 HTML 패널에도 같은 값을 동기화한다.
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
      hud.clockText,
      hud.miniMapFrame,
      hud.miniMapTitle,
    ];
  }

  global.DungeonHud = {
    // Scene이 호출할 공개 API.
    createHud,
    refreshHud,
    getHudElementsToIgnore,
  };
})(window);
