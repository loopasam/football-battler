import Phaser from 'phaser';
import {
  AWAY_TEAM,
  BUILD_UP_TARGET,
  HOME_TEAM,
  completePass,
  createMatch,
  getWinner,
  resolveShot,
  startAttack,
  type MatchState,
  type PlayerCard,
  type Side,
  type TeamDefinition,
} from './model';

const COLORS = {
  background: 0x0c1412,
  pitch: 0x101d19,
  pitchAlt: 0x13231e,
  line: 0x416257,
  faintLine: 0x284139,
  paper: 0xe9f1e6,
  muted: 0x84958d,
  ink: 0x08100e,
  home: 0x85ffbb,
  away: 0xffb36b,
  card: 0x111b18,
  ball: 0xf8ff9a,
  danger: 0xff7777,
  button: 0xe9f1e6,
};

interface Point {
  x: number;
  y: number;
}

const CARD_POSITIONS: Record<string, Point> = {
  'away-gk': { x: 165, y: 215 },
  'away-cb': { x: 435, y: 215 },
  'away-m1': { x: 435, y: 325 },
  'away-m2': { x: 165, y: 325 },
  'away-st': { x: 300, y: 435 },
  'home-st': { x: 300, y: 545 },
  'home-m2': { x: 165, y: 655 },
  'home-m1': { x: 435, y: 655 },
  'home-cb': { x: 435, y: 765 },
  'home-gk': { x: 165, y: 765 },
};

const ROUTES: Record<Side, string[]> = {
  home: HOME_TEAM.cards.map((card) => card.id),
  away: AWAY_TEAM.cards.map((card) => card.id),
};

export class GameScene extends Phaser.Scene {
  private match: MatchState = createMatch();
  private locked = false;
  private ball!: Phaser.GameObjects.Arc;
  private scoreText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private homeDefenseText!: Phaser.GameObjects.Text;
  private awayDefenseText!: Phaser.GameObjects.Text;
  private homeDefenseFill!: Phaser.GameObjects.Rectangle;
  private awayDefenseFill!: Phaser.GameObjects.Rectangle;
  private actionText!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private buttonText!: Phaser.GameObjects.Text;
  private buttonBackground!: Phaser.GameObjects.Rectangle;
  private buildPips: Phaser.GameObjects.Rectangle[] = [];
  private cardBodies = new Map<string, Phaser.GameObjects.Rectangle>();

  constructor() {
    super('match');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.drawHeader();
    this.drawPitch();
    this.drawTeam(HOME_TEAM, 'home');
    this.drawTeam(AWAY_TEAM, 'away');
    this.createBall();
    this.createActionButton();
    this.updatePresentation('HOME ATTACK READY');

    this.input.keyboard?.on('keydown-SPACE', () => this.handlePrimaryAction());
    this.input.keyboard?.on('keydown-ENTER', () => this.handlePrimaryAction());
  }

  private drawHeader(): void {
    this.addText(20, 16, 'HOME', 17, COLORS.home);
    this.addText(580, 16, 'AWAY', 17, COLORS.away).setOrigin(1, 0);

    this.addText(20, 44, 'TEAM DEFENSE', 10, COLORS.muted);
    this.addText(580, 44, 'TEAM DEFENSE', 10, COLORS.muted).setOrigin(1, 0);

    this.add.rectangle(95, 72, 150, 11, COLORS.faintLine).setOrigin(0.5);
    this.add.rectangle(505, 72, 150, 11, COLORS.faintLine).setOrigin(0.5);
    this.homeDefenseFill = this.add.rectangle(20, 72, 150, 11, COLORS.home).setOrigin(0, 0.5);
    this.awayDefenseFill = this.add.rectangle(430, 72, 150, 11, COLORS.away).setOrigin(0, 0.5);
    this.homeDefenseText = this.addText(20, 86, '', 11, COLORS.paper);
    this.awayDefenseText = this.addText(580, 86, '', 11, COLORS.paper).setOrigin(1, 0);

    this.scoreText = this.addText(300, 22, '0 — 0', 31, COLORS.paper).setOrigin(0.5, 0);
    this.roundText = this.addText(300, 65, 'ROUND 1 / 5', 12, COLORS.muted).setOrigin(0.5, 0);

    const pipStartX = 248;
    for (let index = 0; index < BUILD_UP_TARGET; index += 1) {
      const pip = this.add.rectangle(pipStartX + index * 34, 112, 24, 9, COLORS.faintLine);
      this.buildPips.push(pip);
    }
    this.addText(225, 105, 'BUILD', 10, COLORS.muted).setOrigin(1, 0);
    this.addText(382, 103, '→ SHOT', 12, COLORS.muted);
    this.actionText = this.addText(300, 132, '', 12, COLORS.paper).setOrigin(0.5, 0);
  }

  private drawPitch(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.pitch, 1);
    graphics.fillRect(20, 160, 560, 660);

    const zoneHeight = 110;
    for (let zone = 0; zone < 6; zone += 1) {
      if (zone % 2 === 0) {
        graphics.fillStyle(COLORS.pitchAlt, 0.72);
        graphics.fillRect(20, 160 + zone * zoneHeight, 560, zoneHeight);
      }
    }

    graphics.lineStyle(2, COLORS.line, 0.9);
    graphics.strokeRect(20, 160, 560, 660);
    graphics.lineBetween(20, 490, 580, 490);
    graphics.strokeCircle(300, 490, 54);
    graphics.lineStyle(1, COLORS.faintLine, 0.95);
    for (let zone = 1; zone < 6; zone += 1) {
      graphics.lineBetween(20, 160 + zone * zoneHeight, 580, 160 + zone * zoneHeight);
    }

    this.addText(30, 168, 'AWAY • DEFENSE', 9, COLORS.muted);
    this.addText(30, 278, 'AWAY • MIDFIELD', 9, COLORS.muted);
    this.addText(30, 388, 'AWAY • ATTACK', 9, COLORS.muted);
    this.addText(30, 498, 'HOME • ATTACK', 9, COLORS.muted);
    this.addText(30, 608, 'HOME • MIDFIELD', 9, COLORS.muted);
    this.addText(30, 718, 'HOME • DEFENSE', 9, COLORS.muted);

    graphics.lineStyle(3, COLORS.paper, 0.72);
    graphics.strokeRect(220, 144, 160, 16);
    graphics.strokeRect(220, 820, 160, 16);
    this.addText(300, 142, 'AWAY GOAL', 9, COLORS.muted).setOrigin(0.5, 1);
    this.addText(300, 840, 'HOME GOAL', 9, COLORS.muted).setOrigin(0.5, 0);

    this.eventText = this.addText(300, 868, '', 16, COLORS.paper).setOrigin(0.5, 0);
  }

  private drawTeam(team: TeamDefinition, side: Side): void {
    const color = side === 'home' ? COLORS.home : COLORS.away;
    team.cards.forEach((card) => this.drawCard(card, color));
  }

  private drawCard(card: PlayerCard, color: number): void {
    const position = CARD_POSITIONS[card.id];
    const container = this.add.container(position.x, position.y);
    const body = this.add.rectangle(0, 0, 180, 92, COLORS.card).setStrokeStyle(2, color, 0.75);
    const role = this.add.rectangle(-70, -34, 38, 18, color);

    container.add([
      body,
      role,
      this.addText(-70, -34, card.role, 10, COLORS.ink).setOrigin(0.5),
      this.addText(-45, -41, card.name.toUpperCase(), 12, COLORS.paper),
      this.addText(-70, -4, `ATK ${String(card.attack).padStart(2, '0')}`, 19, color),
      this.addText(70, -4, `DEF ${String(card.defense).padStart(2, '0')}`, 19, COLORS.paper).setOrigin(1, 0),
      this.addText(0, 29, 'STATIC CARD', 9, COLORS.muted).setOrigin(0.5, 0),
    ]);
    this.cardBodies.set(card.id, body);
  }

  private createBall(): void {
    const start = CARD_POSITIONS[ROUTES.home[0]];
    this.ball = this.add.circle(start.x, start.y + 51, 10, COLORS.ball)
      .setStrokeStyle(3, COLORS.ink)
      .setDepth(20);
  }

  private createActionButton(): void {
    this.buttonBackground = this.add.rectangle(300, 950, 390, 70, COLORS.button)
      .setStrokeStyle(2, COLORS.ink)
      .setInteractive({ useHandCursor: true });
    this.buttonText = this.addText(300, 950, '', 18, COLORS.ink).setOrigin(0.5);

    this.buttonBackground.on('pointerover', () => {
      if (!this.locked) this.buttonBackground.setFillStyle(COLORS.home);
    });
    this.buttonBackground.on('pointerout', () => {
      this.buttonBackground.setFillStyle(COLORS.button);
    });
    this.buttonBackground.on('pointerdown', () => this.handlePrimaryAction());
  }

  private handlePrimaryAction(): void {
    if (this.locked) return;
    if (this.match.phase === 'finished') {
      this.restartMatch();
      return;
    }
    this.playAttack();
  }

  private playAttack(): void {
    this.locked = true;
    this.buttonBackground.disableInteractive().setAlpha(0.42);
    this.buttonText.setText('ATTACK IN PROGRESS');
    this.match = startAttack(this.match);
    this.eventText.setText('POSSESSION STARTED').setColor(this.toCss(this.sideColor(this.match.attacking)));
    this.updatePresentation();
    this.announce(`${this.sideLabel(this.match.attacking)} possession started.`);

    const route = ROUTES[this.match.attacking];
    const start = CARD_POSITIONS[route[0]];
    this.ball.setPosition(start.x, start.y + 51).setVisible(true);
    this.highlightCard(route[0]);
    this.time.delayedCall(350, () => this.animatePass(route, 1));
  }

  private animatePass(route: string[], routeIndex: number): void {
    if (routeIndex >= route.length) {
      this.animateShot(route[route.length - 1]);
      return;
    }

    const targetId = route[routeIndex];
    const target = CARD_POSITIONS[targetId];
    const line = this.add.graphics().setDepth(5);
    line.lineStyle(2, this.sideColor(this.match.attacking), 0.55);
    line.lineBetween(this.ball.x, this.ball.y, target.x, target.y + 51);
    this.eventText.setText(`PASS ${routeIndex} / ${BUILD_UP_TARGET}`);

    this.tweens.add({
      targets: this.ball,
      x: target.x,
      y: target.y + 51,
      duration: 520,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        line.destroy();
        this.match = completePass(this.match);
        this.highlightCard(targetId);
        this.updatePresentation();
        this.announce(`Pass ${routeIndex} completed. Build-Up ${this.match.buildUp} of ${BUILD_UP_TARGET}.`);
        this.time.delayedCall(220, () => this.animatePass(route, routeIndex + 1));
      },
    });
  }

  private animateShot(shooterId: string): void {
    const attackingSide = this.match.attacking;
    const team = this.teamFor(attackingSide);
    const shooter = team.cards.find((card) => card.id === shooterId);
    if (!shooter) throw new Error(`Missing shooter card: ${shooterId}`);

    const goal = attackingSide === 'home' ? { x: 300, y: 144 } : { x: 300, y: 836 };
    const line = this.add.graphics().setDepth(5);
    line.lineStyle(4, COLORS.ball, 0.72);
    line.lineBetween(this.ball.x, this.ball.y, goal.x, goal.y);
    this.eventText.setText(`SHOT • ${shooter.name.toUpperCase()} • ATK ${shooter.attack}`);
    this.actionText.setText('CHANCE CREATED • SHOT RELEASED').setColor(this.toCss(COLORS.ball));
    this.announce(`${shooter.name} shoots with Attack ${shooter.attack}.`);

    this.tweens.add({
      targets: this.ball,
      x: goal.x,
      y: goal.y,
      scale: 1.65,
      duration: 660,
      ease: 'Quad.easeIn',
      onComplete: () => {
        line.destroy();
        this.ball.setScale(1);
        const defendingSide: Side = attackingSide === 'home' ? 'away' : 'home';
        this.match = resolveShot(this.match, shooter.attack);
        const shot = this.match.lastShot;
        if (!shot) throw new Error('Shot resolution was not recorded.');

        if (shot.goal) {
          this.updatePresentation(`GOAL • ${this.sideLabel(attackingSide)} +1`, {
            side: defendingSide,
            defense: 0,
          });
          this.eventText.setColor(this.toCss(this.sideColor(attackingSide)));
          this.cameras.main.flash(260, 233, 241, 230, false);
          this.announce(`Goal for ${this.sideLabel(attackingSide)}. The score is ${this.match.home.score} to ${this.match.away.score}.`);
        } else {
          this.updatePresentation(
            `SHOT ${shooter.attack} • ${this.sideLabel(defendingSide)} DEFENSE ${shot.defenseAfter} / ${this.match[defendingSide].maxDefense}`,
          );
          this.announce(`${this.sideLabel(defendingSide)} Defense reduced to ${shot.defenseAfter}.`);
        }

        this.time.delayedCall(1150, () => this.finishAttack());
      },
    });
  }

  private finishAttack(): void {
    if (this.match.phase === 'finished') {
      const winner = getWinner(this.match);
      const result = winner === 'draw' ? 'FULL TIME • DRAW' : `FULL TIME • ${this.sideLabel(winner ?? 'home')} WINS`;
      this.updatePresentation(result);
      this.eventText.setColor(this.toCss(COLORS.paper));
      this.buttonText.setText('RESTART MATCH');
      this.buttonBackground.setAlpha(1).setInteractive({ useHandCursor: true });
      this.locked = false;
      this.announce(`Full time. Final score Home ${this.match.home.score}, Away ${this.match.away.score}. ${result}.`);
      return;
    }

    const nextStart = CARD_POSITIONS[ROUTES[this.match.attacking][0]];
    this.ball.setPosition(nextStart.x, nextStart.y + 51);
    this.highlightCard(ROUTES[this.match.attacking][0]);
    this.updatePresentation(`${this.sideLabel(this.match.attacking)} ATTACK READY`);
    this.buttonBackground.setAlpha(1).setInteractive({ useHandCursor: true });
    this.locked = false;
  }

  private restartMatch(): void {
    this.tweens.killAll();
    this.match = createMatch();
    const start = CARD_POSITIONS[ROUTES.home[0]];
    this.ball.setPosition(start.x, start.y + 51).setScale(1).setVisible(true);
    this.highlightCard(ROUTES.home[0]);
    this.eventText.setColor(this.toCss(COLORS.home));
    this.updatePresentation('HOME ATTACK READY');
    this.announce('New five-round match. Home attacks first.');
  }

  private updatePresentation(
    event?: string,
    defenseOverride?: { side: Side; defense: number },
  ): void {
    const homeDefense = defenseOverride?.side === 'home' ? defenseOverride.defense : this.match.home.defense;
    const awayDefense = defenseOverride?.side === 'away' ? defenseOverride.defense : this.match.away.defense;
    const homeRatio = homeDefense / this.match.home.maxDefense;
    const awayRatio = awayDefense / this.match.away.maxDefense;

    this.homeDefenseFill.width = 150 * homeRatio;
    this.awayDefenseFill.width = 150 * awayRatio;
    this.homeDefenseFill.setFillStyle(homeRatio <= 0.25 ? COLORS.danger : COLORS.home);
    this.awayDefenseFill.setFillStyle(awayRatio <= 0.25 ? COLORS.danger : COLORS.away);
    this.homeDefenseText.setText(`${homeDefense} / ${this.match.home.maxDefense}`);
    this.awayDefenseText.setText(`${awayDefense} / ${this.match.away.maxDefense}`);
    this.scoreText.setText(`${this.match.home.score} — ${this.match.away.score}`);
    this.roundText.setText(`ROUND ${this.match.round} / 5`);

    this.buildPips.forEach((pip, index) => {
      pip.setFillStyle(index < this.match.buildUp ? this.sideColor(this.match.attacking) : COLORS.faintLine);
    });

    if (this.match.phase === 'ready') {
      this.actionText
        .setText(`${this.sideLabel(this.match.attacking)} POSSESSION • BUILD-UP 0 / ${BUILD_UP_TARGET}`)
        .setColor(this.toCss(this.sideColor(this.match.attacking)));
      this.buttonText.setText(`PLAY ${this.sideLabel(this.match.attacking)} ATTACK`);
    } else if (this.match.phase === 'passing') {
      this.actionText
        .setText(`${this.sideLabel(this.match.attacking)} PASSING • BUILD-UP ${this.match.buildUp} / ${BUILD_UP_TARGET}`)
        .setColor(this.toCss(this.sideColor(this.match.attacking)));
    } else if (this.match.phase === 'finished') {
      this.actionText.setText('FIVE ROUNDS COMPLETE').setColor(this.toCss(COLORS.paper));
    }

    if (event) this.eventText.setText(event);
  }

  private highlightCard(cardId: string): void {
    this.cardBodies.forEach((body, id) => {
      const side: Side = id.startsWith('home') ? 'home' : 'away';
      if (id === cardId) {
        body.setStrokeStyle(4, COLORS.ball, 1);
      } else {
        body.setStrokeStyle(2, this.sideColor(side), 0.72);
      }
    });
  }

  private teamFor(side: Side): TeamDefinition {
    return side === 'home' ? HOME_TEAM : AWAY_TEAM;
  }

  private sideColor(side: Side): number {
    return side === 'home' ? COLORS.home : COLORS.away;
  }

  private sideLabel(side: Side): string {
    return side === 'home' ? 'HOME' : 'AWAY';
  }

  private addText(x: number, y: number, text: string, size: number, color: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      color: this.toCss(color),
      fontFamily: 'Courier New, monospace',
      fontSize: `${size}px`,
      fontStyle: 'bold',
    });
  }

  private toCss(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private announce(message: string): void {
    const status = document.querySelector<HTMLElement>('#game-status');
    if (status) status.textContent = message;
  }
}
