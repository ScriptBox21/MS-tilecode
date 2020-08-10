namespace tileworld.ruleediting {

    const yoff = 6;
    const helpStringTop = "41any,31moved left,51moved right,40moved up,42moved down,32rested,52moved,71dpad left,91dpad right,80dpad up,82dpad down,81A button,";
    const helpStringBot = "35smash left,44smash up,46smash down,55smash right,74never,";

    export class RuleRoom extends RuleDisplay {
        private kind: number;
        private moreHelp: Sprite;
        constructor(p: Project) {
            super(p, null);
            this.kind = 0;
            // set cursor
            this.setCol(0);
            this.setRow(1 + this.kind);
            this.setTileSaved();
            this.setRow(0);
            this.moreHelp = sprites.create(cursorIn);
            this.moreHelp.setFlag(SpriteFlag.Invisible, true);
            this.moreHelp.x = 84;
            this.moreHelp.y = yoff + 64 + 7;

            this.update();
            controller.A.onEvent(ControllerButtonEvent.Pressed, () => {
                if (this.col() == 0 && this.row() >= 1 && this.row() <= this.p.spriteCnt()) {
                    this.kind = this.row() - 1;
                    this.setTileSaved();
                    this.update();
                } else {
                    const rt = this.ruleTypeMap.getPixel(this.col(), this.row());
                    const dir = this.dirMap.getPixel(this.col(), this.row());
                    if (rt != 0xf) {
                        const rules = this.p.getRulesForSpriteKind(this.kind);
                        const filteredRules = this.getRulesForTypeDir(rules, rt, dir);
                        if (filteredRules.length == 0) {
                            filteredRules.push(this.p.makeRule(rt, dir, this.kind));
                        }
                        game.pushScene();
                        new RuleEditor(this.p, filteredRules[0], this.kind);
                    }
                }
            });
            controller.B.onEvent(ControllerButtonEvent.Pressed, () => {
                game.popScene();
            });
        }

        protected cursorMove(dir: MoveDirection, pressed: boolean): void {
            if (this.p.help) {
                this.helpCursor.x = this.col() < 7 ? this.cursor.x + 8 : this.cursor.x - 16;
                this.helpCursor.y = this.row() < 6 ? this.cursor.y + 32 : this.cursor.y;
                if (this.col() > 0) {
                    const message = getHelp(this.row() < 4 ? helpStringTop : helpStringBot, this.col(), this.row());
                    this.helpCursor.say(message);
                } else {
                    this.helpCursor.say(null);
                    this.moreHelp.say(null);
                }
            }
        }

        protected update(): void {
            screen.fill(15);
            screen.fillRect(0, yoff, 16, 16, 11);
            screen.drawTransparentImage(code, 0, yoff)
            this.showRuleMenu(1, 0);
            this.p.spriteImages().forEach((img,i) => {
                this.drawImage(0, 1+i, img);
            })
        }

        protected centerImage(): Image {
            return this.p.getSpriteImage(this.kind);
        }

        private make3by3(col: number, row: number) {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    this.drawImage(col+i, row+j, emptyTile);
                }
            }
        }

        private setRuleType(rt: RuleType, rd: MoveDirection, col: number, row: number) {
            this.ruleTypeMap.setPixel(col, row, rt);
            this.dirMap.setPixel(col, row, rd);
        }

        private rules: RuleView[];
        private doBoth(rt: RuleType, rd: number, col: number, row: number, center = true) {
            const scol = 13;
            const rules = this.getRulesForTypeDir(this.rules, rt, rd);
            if (rt == RuleType.Collision && rd != Resting) {
                const tcol = col + moveXdelta(rd);
                const trow = row + moveYdelta(rd);
                this.setRuleType(rt, rd, tcol, trow);
                if (rules.length > 0) { this.fillTile(tcol, trow, scol); this.drawOutline(tcol,trow, 1); }
            } else if (rt == RuleType.ButtonPress) {
                const tcol = rd < ButtonArg.A ? col - moveXdelta(rd) : col;
                const trow = rd < ButtonArg.A ? row - moveYdelta(rd) : row;
                this.setRuleType(rt, rd, tcol, trow);
                if (rules.length > 0) { this.fillTile(tcol, trow, scol); this.drawOutline(tcol, trow, 1); }
                this.drawImage(tcol, trow, buttonImages[rd]);
            } else if (rt == RuleType.ContextChange || rt == RuleType.NegationCheck) {
                this.setRuleType(rt, rd, col, row);
                if (rules.length > 0) { this.fillTile(col, row, scol); this.drawOutline(col, row, 1); }
            }
            if (rt != RuleType.ButtonPress)
                this.showRuleType(rt, rd, col, row, center);
        }

        private stringColumn(s: string, col: number, row: number) {
            for(let i = 0; i<s.length; i++) {
                screen.print(s[i], (col << 4) - 8, (row << 4) + (i << 3) + yoff);
            }
        }

        private showRuleMenu(x: number, y: number) {
            this.rules = this.p.getRulesForSpriteKind(this.kind);
            
            const left1 = 3;
            this.make3by3(x + left1, y + 1)
            this.doBoth(RuleType.ContextChange, AnyDir, x + left1, y + 1);
            this.doBoth(RuleType.ContextChange, MoveDirection.Right, x + left1 + 1, y + 1);
            this.doBoth(RuleType.ContextChange, MoveDirection.Left, x + left1 - 1, y + 1);
            this.doBoth(RuleType.ContextChange, MoveDirection.Up, x + left1, y);
            this.doBoth(RuleType.ContextChange, MoveDirection.Down, x + left1, y+2);
            this.doBoth(RuleType.ContextChange, Resting, x+left1-1, y+2, false);
            this.doBoth(RuleType.ContextChange, Moving, x+left1+1, y+2, false);
            this.stringColumn("change", left1, 0);

            this.make3by3(x + left1, y + 5);
            this.doBoth(RuleType.Collision, MoveDirection.Right, x + left1, y + 5, false);
            this.doBoth(RuleType.Collision, MoveDirection.Left, x + left1, y + 5, false);
            this.doBoth(RuleType.Collision, MoveDirection.Up, x + left1, y + 5, false);
            this.doBoth(RuleType.Collision, MoveDirection.Down, x + left1, y + 5, false);
            this.drawImage(x + left1, y + 5, this.centerImage());
            this.stringColumn("smash", left1, 4);

            const left2 = 7;
            this.make3by3(x + left2, y + 1)
            this.doBoth(RuleType.ButtonPress, ButtonArg.Right, x + left2 + 2, y + 1, false);
            this.doBoth(RuleType.ButtonPress, ButtonArg.Left, x + left2 - 2, y + 1, false);
            this.doBoth(RuleType.ButtonPress, ButtonArg.Down, x + left2, y + 3, false);
            this.doBoth(RuleType.ButtonPress, ButtonArg.Up, x + left2, y - 1, false);
            this.doBoth(RuleType.ButtonPress, ButtonArg.A, x + left2, y + 1, false); 
            this.stringColumn("press", left2, 0);

            this.make3by3(x + left2, y + 5);
            this.doBoth(RuleType.NegationCheck, AnyDir, x + left2 - 1, y + 4, false);
            this.stringColumn("misc", left2, 4);
        }
    }
}