import Phaser from 'phaser';
import ScoreManager from '../managers/ScoreManager.js';

export default class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  init(data) {
    this.result = data?.result || 'win';
    this.finalScore = data?.score ?? 0;
    this.stage = data?.stage ?? 1;
    this.step = data?.step ?? 1;
    window.ultimateStacks = 0;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(this.result === 'win' ? '#10251a' : '#2a1212');
    this.add.rectangle(width / 2, height / 2, width, height, this.result === 'win' ? 0x10251a : 0x2a1212, 1);

    const title = this.result === 'win' ? 'YOU WIN' : 'GAME OVER';
    const subtitle = this.result === 'win' ? '보스를 쓰러뜨렸습니다' : '플레이어가 쓰러졌습니다';

    this.add.text(width / 2, 80, title, {
      fontFamily: 'Arial',
      fontSize: '64px',
      color: this.result === 'win' ? '#aaf0a8' : '#ffaaaa'
    }).setOrigin(0.5);

    this.add.text(width / 2, 140, subtitle, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#edf3ff'
    }).setOrigin(0.5);

    this.add.text(width / 2, 180, `스테이지 ${this.stage}-${this.step} | 최종 점수: ${this.finalScore}`, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#ffe08a',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.loadingText = this.add.text(width / 2, 230, '랭킹 불러오는 중...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#b9c9e8'
    }).setOrigin(0.5);

    this.rankingContainer = this.add.container(0, 0);
    this.entryFormContainer = this.add.container(0, 0);

    ScoreManager.init();
    this.loadRanking();
  }

  async loadRanking() {
    try {
      const top10 = await ScoreManager.getTop10(this.stage);
      this.currentTop10 = top10;
      this.loadingText?.destroy();
      this.loadingText = null;
      this.renderRanking(top10);

      const eligible = ScoreManager.isEligibleForTop10(top10, this.finalScore) && this.finalScore > 0;
      if (eligible) {
        this.showEntryForm(top10);
      } else {
        this.showContinuePrompt();
      }
    } catch (err) {
      console.warn('[EndScene] loadRanking error:', err);
      this.loadingText?.setText('랭킹을 불러올 수 없습니다');
      this.currentTop10 = [];
      this.showContinuePrompt();
    }
  }

  renderRanking(rankingList) {
    const { width } = this.scale;
    const baseY = 270;
    const rowH = 32;
    const panelW = 860;
    const panelH = Math.max(380, rowH * 12 + 40);
    const panelX = (width - panelW) / 2;

    const panel = this.add.rectangle(width / 2, baseY + panelH / 2 - 20, panelW, panelH, 0x0a0e18, 0.88);
    panel.setStrokeStyle(2, 0x3a4a6a, 0.8);
    this.rankingContainer.add(panel);

    const headers = ['순위', '날짜', '닉네임', '점수', '메시지'];
    const colXs = [panelX + 60, panelX + 170, panelX + 340, panelX + 510, panelX + 660];
    headers.forEach((h, i) => {
      const txt = this.add.text(colXs[i], baseY, h, {
        fontFamily: 'Arial', fontSize: '18px', color: '#7ef0c0', fontStyle: 'bold'
      }).setOrigin(i === 3 ? 1 : 0, 0.5);
      this.rankingContainer.add(txt);
    });

    const divider = this.add.line(0, 0, panelX + 20, baseY + 22, panelX + panelW - 20, baseY + 22, 0x3a4a6a, 0.8).setOrigin(0, 0);
    this.rankingContainer.add(divider);

    if (!rankingList || rankingList.length === 0) {
      const empty = this.add.text(width / 2, baseY + 80, '아직 기록이 없습니다. 첫 번째 기록을 세워보세요!', {
        fontFamily: 'Arial', fontSize: '18px', color: '#b9c9e8'
      }).setOrigin(0.5);
      this.rankingContainer.add(empty);
      return;
    }

    rankingList.forEach((entry, idx) => {
      const y = baseY + 44 + idx * rowH;
      const rank = idx + 1;
      const rankColor = rank === 1 ? '#ffd95a' : rank === 2 ? '#d5d9e0' : rank === 3 ? '#e89860' : '#edf3ff';
      const dateStr = ScoreManager.formatDateTime(entry.datetime);
      const nick = entry.nickname || '익명';
      const msg = entry.message || '';

      const rankTxt = this.add.text(colXs[0], y, String(rank), {
        fontFamily: 'Arial', fontSize: '18px', color: rankColor, fontStyle: 'bold'
      }).setOrigin(0, 0.5);
      const dateTxt = this.add.text(colXs[1], y, dateStr, {
        fontFamily: 'Arial', fontSize: '15px', color: '#b9c9e8'
      }).setOrigin(0, 0.5);
      const nickTxt = this.add.text(colXs[2], y, nick, {
        fontFamily: 'Arial', fontSize: '17px', color: '#edf3ff'
      }).setOrigin(0, 0.5);
      const scoreTxt = this.add.text(colXs[3], y, String(entry.score ?? 0), {
        fontFamily: 'Arial', fontSize: '18px', color: '#ffe08a', fontStyle: 'bold'
      }).setOrigin(1, 0.5);
      const msgTxt = this.add.text(colXs[4], y, msg, {
        fontFamily: 'Arial', fontSize: '14px', color: '#8898b0'
      }).setOrigin(0, 0.5);

      [rankTxt, dateTxt, nickTxt, scoreTxt, msgTxt].forEach(t => this.rankingContainer.add(t));
    });
  }

  showEntryForm(currentRanking) {
    const { width, height } = this.scale;
    const formY = height - 210;
    const formW = 860;
    const formX = (width - formW) / 2;

    const highlightMsg = this.add.text(width / 2, formY - 40, `🎉 축하합니다! ${this.finalScore}점으로 TOP 10에 진입했습니다!`, {
      fontFamily: 'Arial', fontSize: '22px', color: '#aaf0a8', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.entryFormContainer.add(highlightMsg);

    const panel = this.add.rectangle(width / 2, formY + 90, formW, 180, 0x141a28, 0.92);
    panel.setStrokeStyle(2, 0x7ef0c0, 0.7);
    this.entryFormContainer.add(panel);

    const formInputY = formY + 30;

    const nickLabel = this.add.text(formX + 40, formInputY, '닉네임:', {
      fontFamily: 'Arial', fontSize: '18px', color: '#edf3ff'
    }).setOrigin(0, 0.5);
    this.entryFormContainer.add(nickLabel);

    const nickInputBg = this.add.rectangle(formX + 150, formInputY, 260, 36, 0x0a0e18, 1);
    nickInputBg.setStrokeStyle(1, 0x5a6a8a, 0.8);
    this.entryFormContainer.add(nickInputBg);

    this.nicknameText = this.add.text(formX + 150, formInputY, '', {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    this.entryFormContainer.add(this.nicknameText);

    const msgLabel = this.add.text(formX + 440, formInputY, '메시지:', {
      fontFamily: 'Arial', fontSize: '18px', color: '#edf3ff'
    }).setOrigin(0, 0.5);
    this.entryFormContainer.add(msgLabel);

    const msgInputBg = this.add.rectangle(formX + 690, formInputY, 280, 36, 0x0a0e18, 1);
    msgInputBg.setStrokeStyle(1, 0x5a6a8a, 0.8);
    this.entryFormContainer.add(msgInputBg);

    this.messageText = this.add.text(formX + 690, formInputY, '', {
      fontFamily: 'Arial', fontSize: '16px', color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    this.entryFormContainer.add(this.messageText);

    this.inputHint = this.add.text(width / 2, formInputY + 40, '닉네임 또는 메시지를 클릭하고 키보드로 입력하세요 | Tab으로 전환', {
      fontFamily: 'Arial', fontSize: '14px', color: '#8898b0'
    }).setOrigin(0.5);
    this.entryFormContainer.add(this.inputHint);

    const submitBtn = this.add.rectangle(width / 2 - 120, formInputY + 80, 200, 44, 0x1a7a5a, 0.9);
    submitBtn.setStrokeStyle(2, 0x7ef0c0, 0.9);
    submitBtn.setInteractive({ useHandCursor: true });
    const submitLabel = this.add.text(width / 2 - 120, formInputY + 80, '기록 저장', {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    submitBtn.on('pointerover', () => submitBtn.setFillStyle(0x229977, 0.95));
    submitBtn.on('pointerout', () => submitBtn.setFillStyle(0x1a7a5a, 0.9));
    submitBtn.on('pointerdown', () => this.submitEntry());
    this.entryFormContainer.add([submitBtn, submitLabel]);

    const skipBtn = this.add.rectangle(width / 2 + 120, formInputY + 80, 200, 44, 0x3a3a4a, 0.9);
    skipBtn.setStrokeStyle(2, 0x8a8aa0, 0.7);
    skipBtn.setInteractive({ useHandCursor: true });
    const skipLabel = this.add.text(width / 2 + 120, formInputY + 80, '건너뛰기', {
      fontFamily: 'Arial', fontSize: '18px', color: '#c0c8d8'
    }).setOrigin(0.5);
    skipBtn.on('pointerover', () => skipBtn.setFillStyle(0x4a4a5a, 0.95));
    skipBtn.on('pointerout', () => skipBtn.setFillStyle(0x3a3a4a, 0.9));
    skipBtn.on('pointerdown', () => {
      this.entryFormContainer.destroy();
      this.showContinuePrompt();
    });
    this.entryFormContainer.add([skipBtn, skipLabel]);

    this.activeField = 'nickname';
    this.nicknameValue = '';
    this.messageValue = '';
    this.cursorVisible = true;
    this._cursorTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        this.cursorVisible = !this.cursorVisible;
        this.updateFieldTexts();
      }
    });

    nickInputBg.setInteractive({ useHandCursor: true });
    nickInputBg.on('pointerdown', () => { this.activeField = 'nickname'; this.updateFieldTexts(); });
    this.nicknameText.setInteractive({ useHandCursor: true });
    this.nicknameText.on('pointerdown', () => { this.activeField = 'nickname'; this.updateFieldTexts(); });

    msgInputBg.setInteractive({ useHandCursor: true });
    msgInputBg.on('pointerdown', () => { this.activeField = 'message'; this.updateFieldTexts(); });
    this.messageText.setInteractive({ useHandCursor: true });
    this.messageText.on('pointerdown', () => { this.activeField = 'message'; this.updateFieldTexts(); });

    this.input.keyboard.on('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        this.activeField = this.activeField === 'nickname' ? 'message' : 'nickname';
        this.updateFieldTexts();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitEntry();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.entryFormContainer.destroy();
        this.showContinuePrompt();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (this.activeField === 'nickname') {
          this.nicknameValue = this.nicknameValue.slice(0, -1);
        } else {
          this.messageValue = this.messageValue.slice(0, -1);
        }
        this.updateFieldTexts();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (this.activeField === 'nickname' && this.nicknameValue.length < 20) {
          this.nicknameValue += e.key;
        } else if (this.activeField === 'message' && this.messageValue.length < 50) {
          this.messageValue += e.key;
        }
        this.updateFieldTexts();
      }
    });

    this.updateFieldTexts();
  }

  updateFieldTexts() {
    if (!this.nicknameText?.active || !this.messageText?.active) return;
    const nickDisplay = this.nicknameValue + (this.activeField === 'nickname' && this.cursorVisible ? '|' : '');
    const msgDisplay = this.messageValue + (this.activeField === 'message' && this.cursorVisible ? '|' : '');
    this.nicknameText.setText(nickDisplay);
    this.messageText.setText(msgDisplay);
  }

  async submitEntry() {
    if (this._submitting) return;
    this._submitting = true;
    this.inputHint?.setText('저장 중...');

    try {
      const ok = await ScoreManager.submitScore(this.stage, {
        nickname: (this.nicknameValue || '').trim() || '익명',
        message: (this.messageValue || '').trim(),
        score: this.finalScore
      });

      this._cursorTimer?.remove(false);
      this.entryFormContainer.destroy();
      this.rankingContainer.destroy();
      this.rankingContainer = this.add.container(0, 0);

      const newTop = await ScoreManager.getTop10(this.stage);
      this.renderRanking(newTop);

      if (!ok) {
        const warn = this.add.text(this.scale.width / 2, this.scale.height - 80, '저장에 실패했습니다. 인터넷 연결을 확인하세요.', {
          fontFamily: 'Arial', fontSize: '16px', color: '#ff9999'
        }).setOrigin(0.5);
        this.rankingContainer.add(warn);
      }

      this.showContinuePrompt();
    } catch (err) {
      console.warn(err);
      this.inputHint?.setText('저장 실패. 다시 시도하거나 건너뛰세요.');
      this._submitting = false;
    }
  }

  showContinuePrompt() {
    const { width, height } = this.scale;
    this.continueText = this.add.text(width / 2, height - 40, 'ENTER를 눌러 타이틀로', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffe08a'
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('Title');
    });
  }
}
