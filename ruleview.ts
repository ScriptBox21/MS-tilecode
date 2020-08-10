namespace tileworld {
    
    // a rule view encapsulates a rule and allows editing of the rule
    // as well as creating views of the underlying rule, where the
    // views are mirrors or rotates of the underlying rule
    export class RuleView {
        private view: RuleTransforms = RuleTransforms.None;
        constructor(private p: Project, private rid: number, private r: Rule) {
        }

        public getBaseRule(): Rule {
            return this.r;
        }

        public getDerivedRules(): RuleView[] {
            const ret: RuleView[] = [];
            switch(this.r.transforms){
                case RuleTransforms.HorzMirror:
                case RuleTransforms.VertMirror: 
                case RuleTransforms.LeftRotate: 
                case RuleTransforms.RightRotate:        
                {
                    const rv = new RuleView(this.p, -1, this.r);
                    rv.view = this.r.transforms;
                    ret.push(rv);
                    break;
                }
                case RuleTransforms.Rotate3Way: {
                    for (let t = RuleTransforms.LeftRotate; t != RuleTransforms.Rotate3Way; t++) {
                        const rv = new RuleView(this.p, -1, this.r);
                        rv.view = t;
                        ret.push(rv)
                    }
                    break;
                }
            }
            return ret;
        }

        public getViewTransform(): number {
            if (this.rid == -1)
                return this.view;
            return -1;
        }

        public getTransforms(): number {
            return this.r.transforms;
        }

        public setTransforms(n:number): void {
            this.r.transforms = n;
        }

        public getRuleId(): number {
            return this.rid;
        }

        public getRuleType(): RuleType {
            return this.r.ruleType;
        }

        public setRuleType(rt: RuleType): void {
            this.r.ruleType = rt;
        }

        public getRuleArg(): RuleArg {
            return this.rid != -1 ? this.r.ruleArg : 
                this.r.ruleType == RuleType.ButtonPress ? flipRotateDir(this.r.ruleArg, this.view) : this.r.ruleArg;
        }

        public setRuleArg(ra: RuleArg): void  {
            this.r.ruleArg = ra;
        }

        public getDirFromRule(): number {
            const rt = this.getRuleType();
            if (rt == RuleType.Collision || rt == RuleType.ContextChange) {
                const wd = this.getWhenDo(2, 2);
                return wd == -1 ? AnyDir : this.getWitnessDirection(wd);
            } else if (rt == RuleType.ButtonPress) {
                return this.getRuleArg();
            }
            return AnyDir;
        }
        
        private rawView(): number {
             return this.view == RuleTransforms.LeftRotate ? RuleTransforms.RightRotate : 
                   (this.view == RuleTransforms.RightRotate ? RuleTransforms.LeftRotate: this.view);
        }

        public getWhenDo(col: number, row: number): number {
            if (this.rid == -1) {
                const ncol = transformCol(col, row, this.rawView());
                const nrow = transformRow(row, col, this.rawView());
                col = ncol;
                row = nrow;
            }
            const whendo = this.r.whenDo.find(wd => wd.col == col && wd.row == row);
            if (whendo == null)
                return -1;
            else
                return this.r.whenDo.indexOf(whendo);
        }

        public makeWhenDo(col: number, row: number): number {
            const wd = new WhenDo(col, row);
            wd.bgPred = control.createBuffer(this.p.backCnt());
            wd.spPred = control.createBuffer(this.p.spriteCnt()); 
            wd.commandsLen = 0;
            wd.commands = control.createBuffer(MaxCommands << 1);
            this.r.whenDo.push(wd);
            return this.r.whenDo.length - 1;
        }

        public getWhenDoCol(whendo: number): number {
            return this.r.whenDo[whendo].col;
        }

        public getWhenDoRow(whendo: number): number {
            return this.r.whenDo[whendo].row;
        }

        private getSetBuffAttr(buf: Buffer, index: number, val: number): number {
            const byteIndex = index >> 2;
            const byte = buf.getUint8(byteIndex);
            const remainder = index - (byteIndex << 2);
            if (val != 0xffff) {
                const mask = (0x3 << (remainder << 1)) ^ 0xff;
                const newByte = (byte & mask) | ((val & 0x3) << (remainder << 1));
                buf.setUint8(byteIndex, newByte)
            }
            return (byte >> (remainder << 1)) & 0x3;
        }

        public getSetBgAttr(wdid: number, index: number, val = 0xffff): AttrType {
            return this.getSetBuffAttr(this.r.whenDo[wdid].bgPred, index, val);
        }

        public getSetSpAttr(wdid: number, index: number, val = 0xffff): AttrType {
            return this.getSetBuffAttr(this.r.whenDo[wdid].spPred, index, val);
        }

        public attrCnt(whendo: number): number {
            let cnt = 0;
            for (let i = 0; i < this.p.backCnt(); i++) {
                if (this.getSetBgAttr(whendo, i) != AttrType.OK)
                    cnt++;
            }
            for (let i = 0; i < this.p.spriteCnt(); i++) {
                if (this.getSetSpAttr(whendo, i) != AttrType.OK)
                    cnt++;
            }
            return cnt;
        }

        private attrBgIndex(whendo: number, a: AttrType): number {
            for (let i = 0; i < this.p.backCnt(); i++) {
                if (this.getSetBgAttr(whendo, i) == a)
                    return i;
            }
            return -1;
        }

        private attrSpIndex(whendo: number, a: AttrType): number {
            for (let i = 0; i < this.p.spriteCnt(); i++) {
                if (this.getSetSpAttr(whendo, i) == a)
                    return i;
            }
            return -1;
        }

        public findWitnessColRow(col: number, row: number, editor = true): number {
            if (editor && this.getRuleType() == RuleType.NegationCheck)
                return -1;
            const whendo = this.getWhenDo(col, row);
            if (whendo == -1)
                return -1;
            if (this.attrBgIndex(whendo, AttrType.Include) != -1)
                return -1;
            return this.attrSpIndex(whendo, AttrType.Include);
        }

        public getWitnessDirection(wdid: number): number {
            const dir = this.r.whenDo[wdid].dir;
            return (this.rid != -1 || dir >= Resting) ? dir : flipRotateDir(dir, this.view);
        }

        public setWitnessDirection(wdid: number, val:number): void {
            this.r.whenDo[wdid].dir = val;
        }

        public getCmdsLen(wdid: number): number {
            return this.r.whenDo[wdid].commandsLen;
        }

        public getCmdInst(wdid: number, cid: number): number {
            const wd = this.r.whenDo[wdid];
            if (cid >= wd.commandsLen) return 0xff;
            return wd.commands.getUint8(cid << 1);
        }

        public getCmdArg(wdid: number, cid: number): number {
            const wd = this.r.whenDo[wdid];
            if (cid >= wd.commandsLen) return 0xff;
            let arg = wd.commands.getUint8((cid << 1)+1);
            if (this.rid == -1 && this.getCmdInst(wdid, cid) == CommandType.Move) {
                arg = flipRotateDir(arg, this.view);
            }
            return arg;        
        }

        public setCmdInst(wdid: number, cid: number, n: number): number {
            const wd = this.r.whenDo[wdid];
            if (cid > wd.commandsLen)
                return 0xff;
            if (cid == wd.commandsLen)
                wd.commandsLen++;
            wd.commands.setUint8(cid << 1, n & 0xff);
            return n & 0xff;
        }

        public setCmdArg(wdid: number, cid: number, n: number): number {
            const wd = this.r.whenDo[wdid];
            if (cid > wd.commandsLen)
                return 0xff;
            if (cid == wd.commandsLen)
                wd.commandsLen++;
            wd.commands.setUint8((cid << 1)+1, n & 0xff);
            return n & 0xff;
        }

        public removeCommand(wdid: number, cid: number): number {
            const wd = this.r.whenDo[wdid];
            if (wd.commandsLen == 0 || cid >= wd.commandsLen)
                return wd.commandsLen;
            for(let i=(cid << 1); i <= ((MaxCommands-1)<<1)-1; i++) {
                wd.commands.setUint8(i, wd.commands.getUint8(i+2));
            }
            wd.commandsLen--;
            return wd.commandsLen;
        }

        // predicates/misc info

        public getSpriteKinds(): number[] {
            const wd = this.getWhenDo(2, 2);
            const ret: number[] = [];
            for(let i=0; i < this.p.spriteCnt(); i++) {
                const at = this.getSetSpAttr(wd, i);
                // TODO: Include vs. Include2?
                if (at == AttrType.Include || at == AttrType.Include2)
                    ret.push(i);
            }
            return ret;
        }

        public hasSpriteKind(kind: number): boolean {
            const wd = this.getWhenDo(2, 2);
            // TODO: Include vs. Include2?
            return wd == -1 ?  false : this.getSetSpAttr(wd, kind) == AttrType.Include
        }

        public whendoTrue(whendo: number): boolean {
            const wd = this.r.whenDo[whendo];
            return isWhenDoTrue(wd);
        }

        public isRuleTrue(): boolean {
            return isRuleTrue(this.r);
        }

        // printing out a rule

        private whenDoAttrs(wd: number, a: AttrType) {
            const ret: string[] = [];
            for(let i = 0; i < this.p.backCnt(); i++) {
                if (this.getSetBgAttr(wd, i) == a)
                    ret.push("b"+i.toString())
            }
            for(let i = 0; i < this.p.spriteCnt(); i++) {
                if (this.getSetSpAttr(wd, i) == a)
                    ret.push("s"+i.toString())
            }
            return ret;
        }

		private ruleArgToString() {
            if (this.getRuleType() != RuleType.ButtonPress)
                return "none"
            return buttonArgToString[this.getRuleArg()];
        }

        private commandArgToString(inst: number, arg: number) {
            if (inst == CommandType.Move) 
                return moveArgToString[arg];
            if (inst == CommandType.Game)
                return gameArgToString[arg];            
            if (inst == CommandType.Paint || inst == CommandType.Spawn || inst == CommandType.Portal)
                return arg.toString();
            return "none";
        }

        public printRule(): void {
            // rule header
            console.log("id:"+this.getRuleId().toString());
            console.log("rule:"+ruleToString[this.getRuleType()]+":"+this.ruleArgToString());
            // rule body
            this.getBaseRule().whenDo.forEach((wd,wdi) => { 
                console.log("tile:"+wd.col.toString()+":"+wd.row.toString());
                // output attributes
                console.log("include:"+this.whenDoAttrs(wdi,AttrType.Include).join(":"));
                console.log("include2:"+this.whenDoAttrs(wdi,AttrType.Include2).join(":"));
                console.log("exclude:"+this.whenDoAttrs(wdi,AttrType.Exclude).join(":"));
                // output commands
                for(let i=0; i<wd.commandsLen; i++) {
                    const inst = this.getCmdInst(wdi, i);
                    const arg = this.getCmdArg(wdi, i)
                    console.log("cmd:"+cmdInstToString[inst]+":"+this.commandArgToString(inst, arg))
                }
            });
            console.log("\n");
        }
    }
}