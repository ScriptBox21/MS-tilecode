// ---------------------------------------------------------------------------
// binary read/write of a rule

let ruleBuf: Buffer = null
let bitIndex = 0;

function readWriteBuf(v: number, bits: number, write: boolean): number {
    const byteIndex = bitIndex >> 3;
    if (byteIndex >= ruleBuf.length) {
        // shouldn't get here
        control.assert(false, 43);
    }
    const shift = bitIndex - (byteIndex << 3);
    if (shift + bits > 8) {
        // packing error - can't have value that spans byte boundary
        control.assert(false, 44);
    }
    let byte = ruleBuf.getUint8(byteIndex);
    let mask = 0;
    for(let i=0; i<bits; i++) { mask = 0x1 | (mask << 1); }
    // make sure we only keep the proper number of bits from v
    v = v & mask;
    mask = mask << shift;
    const writeMask = mask ^ 0xffffffff;

    if (write) {
        const newVal = (byte & writeMask) | (v << shift);
        ruleBuf.setUint8(byteIndex, newVal);
    }
    
    bitIndex += bits;

    byte = ruleBuf.getUint8(byteIndex);
    const ret = (byte & mask) >> shift
    if (write) {
        control.assert(ret == v, 42);
    }
    return ret;
}

function writeBuf(v: number, bits: number) {
    readWriteBuf(v, bits, true);
}

// must be byte-aligned when writing a raw buffer
function writeBufRaw(b: Buffer, cnt: number) {
    for(let i = 0; i < cnt; i++) {
        writeBuf(b.getUint8(i), 8);
    }
}

function readBuf(bits: number) {
    return readWriteBuf(0, bits, false);
}

// must be byte-aligned when reading a raw buffer
function readBufRaw(bytes: number, cnt: number) {
    const b = control.createBuffer(bytes);
    for (let i = 0; i < cnt; i++) {
        b.setUint8(i, readBuf(8));
    }
    return b;
}

module tileworld {

    // enums must fit in 4 bits (16 values maximum)

    // the first three rule types should have a self (centered) witness sprite
    // that is moving in a direction from MoveDirection

    // the collision rule has two identified sprites (self, other)
    // the self sprite has a direction in MoveDirection 
    // other other sprite is either Resting, Moving, or AnyDir

    export enum RuleType {
        ButtonPress,    // user button press
        ContextChange,  // neighborhood changed
        Collision,      // sprite collision
        NegationCheck,  // check spec
        FirstRule = ButtonPress,
        LastRule = NegationCheck
    }

    export const ruleToString = ["press", "change", "collide", "negate"]

    // directions are 0-3 and move clockwise
    export enum MoveDirection {
        Left, Up, Right, Down
    }

    export const Resting = 4;
    export const Moving = 5;
    export const AnyDir = 6;

    export type Resting = 4;
    export type Moving = 5;
    export type AnyDir = 6;

    export type MoveRest = MoveDirection | Resting

    export type MoveExpr = MoveRest | Moving | AnyDir;

    export enum ButtonArg {
        Left, Up, Right, Down, A, B
    }

    export const buttonArgToString = ["left", "up", "right", "down", "A"]

    export type RuleArg = number | ButtonArg;

    export enum CommandType {
        Move,           // sprite move in (MoveDirection) + Stop, UTurn
        Paint,          // paint a tile with a background
        Spawn,          // spawn a sprite at a tile going in a direction (requires 4-bits for sprite and 4-bits for direction)
        Sprite,         // various commands for sprites
        Game,           // various top-level game commands
        Portal,         // open a portal to a tile of particular background (random)
        BlockSpriteRules, // in the next round, don't allow rules on sprite kind
        Last,
    }

    export const cmdInstToString = ["move", "paint", "spawn", "destroy", "game", "portal", "block"]

    // arguments to Move command (the last two are only used in Colliding rules)
    export enum MoveArg {
        Left, Up, Right, Down,
        Stop, UTurn,
    }

    export const moveArgToString = [ "left", "up", "right", "down", "stop", "u-turn" ]

    // arguments to affect the state of the sprite (other than movement)
    export enum SpriteArg {
        Remove,         // self sprite eats the other sprite
    }

    // only Win, Lose implemented so far
    export enum GameArg {
        Win, Lose, 
        ScoreUp10,
        NextLevel
    }

    export const gameArgToString = ["win", "lose", "score10"]

    export enum AttrType {
        OK,        // don't care
        Include,   // tile must contain one from this
        Include2,  // second include set
        Exclude,   // tile cannot contain this
    }

    export class Command {
        constructor(
            public inst: CommandType,                           // one byte
            public arg: MoveArg | SpriteArg | GameArg | number  // one byte
        ) { }
    }

    export const MaxCommands = 4;

    // a tile "predicate" at (col,row), where (2,2) is center and associated commands
    // ties together coordinate, predicate, and actions. It's useful to pair the first
    // two since we don't expect many predicates 
    export class WhenDo {
        constructor(
            public col: number,             // the guards and commands associated with a tile in the neighborhood
            public row: number,             // (2,2) is the center of neighborhood, graphics coordinate system
            public bgPred: Buffer = null,   // predicate on background (2 bits per background)
            public spPred: Buffer = null,   // predicate on sprites (2 bits for sprite)
            public dir: MoveDirection = 0, // direction to match against (for movable sprite)
            public commands: Buffer = null, // the commands that execute if the guard succeeds (2 bytes per command)
            public commandsLen: number = 0
        ) { 
            this.dir = AnyDir;   // because we can't put AnyDir as default
        }
    }

    // Rotate3Way = {LeftRotate, RightRotate, DoubleRotate}
    export enum RuleTransforms { Begin=0, None=0, HorzMirror, VertMirror, LeftRotate, DoubleRotate, RightRotate, Rotate3Way, End=Rotate3Way }

    export class Rule {
        constructor( 
            public ruleType: RuleType,  // the type of rule
            public ruleArg: number,     // rule argument
            public whenDo: WhenDo[],    // guarded commands
            public transforms: RuleTransforms = RuleTransforms.None
        ) { }
    }

    // transform: FlipRotate of rule with different id

    export function makeNewRule(rt: RuleType, ra: RuleArg): Rule {
        return new Rule(rt, ra, []);
    }

    export function moveXdelta(dir: MoveDirection): number {
        return dir == MoveDirection.Left ? -1 : (dir == MoveDirection.Right ? 1 : 0);
    }

    export function moveYdelta(dir: MoveDirection): number {
        return dir == MoveDirection.Up ? -1 : (dir == MoveDirection.Down ? 1 : 0);
    }

    export function oppDir(dir: MoveDirection, dir2: MoveDirection): boolean {
        return (dir + 2) % 4 == dir2;
    }

    // ---------------------------------------------------------------------------
    // rule transforms

    export function flipRotateDir(d: MoveDirection, rt: RuleTransforms): MoveDirection {
        if (rt == RuleTransforms.None || d >= 4)
            return d;
        if (rt == RuleTransforms.HorzMirror) {
            return d == MoveDirection.Left ? MoveDirection.Right : d == MoveDirection.Right ? MoveDirection.Left : d;
        } else if (rt == RuleTransforms.VertMirror) {
            return d == MoveDirection.Up ? MoveDirection.Down : d == MoveDirection.Down ? MoveDirection.Up : d;
        } else if (rt == RuleTransforms.LeftRotate) {
            return ((d + 3) % 4) | 0x0;
        } else if (rt == RuleTransforms.RightRotate) {
            return ((d + 1) % 4) | 0x0;
        } else if (rt == RuleTransforms.DoubleRotate) {
            return ((d + 2) % 4) | 0x0;
        }
        return d;
    }

    export function transformCol(col: number, row: number, rt: RuleTransforms): number {
        if (rt == RuleTransforms.None)
            return col; 
        else if (rt == RuleTransforms.HorzMirror || rt == RuleTransforms.VertMirror)
            return rt == RuleTransforms.HorzMirror ? 4 - col : col;
        else {
            // make (0,0) center for rotation
            row = row - 2;
            col = col - 2;
            return rt == RuleTransforms.LeftRotate ? row + 2 :
                   rt == RuleTransforms.RightRotate ? -row + 2 : -col + 2;
        }
    }

    export function transformRow(row: number, col: number, rt: RuleTransforms): number {
        if (rt == RuleTransforms.None)
            return row; 
        else if (rt == RuleTransforms.HorzMirror || rt == RuleTransforms.VertMirror)
            return rt == RuleTransforms.HorzMirror ? row : 4 - row;
        else {
            col = col - 2;
            row = row - 2;
            return rt == RuleTransforms.LeftRotate ? (-col) + 2 : 
                   rt == RuleTransforms.RightRotate ? col + 2 : -row + 2;
        }
    }

    // ---------------------------------------------------------------------------
    // rule predicates

    export function isWhenDoTrue(wd: WhenDo): boolean {
        for(let i = 0; i< wd.bgPred.length; i++) {
            if (wd.bgPred.getUint8(i)) return false;
        }
        for (let i = 0; i < wd.spPred.length; i++) {
            if (wd.spPred.getUint8(i)) return false;
        }
        return true;
    }

    export function isRuleTrue(r: Rule): boolean {
        for (let col = 1; col <= 3; col++) {
            for (let row = 1; row <= 3; row++) {
                const whendo = r.whenDo.find((wd) => wd.col == col && wd.row == row); 
                if (whendo && !isWhenDoTrue(whendo))
                    return false;
            }
        }
        return true;
    }

    export function ruleStats(rv: RuleView): [number, number, number] {
        let wdCnt = 0;
        let cmdCnt = 0;
        let attrCnt = 0;
        for (let col = 1; col <= 3; col++) {
            for (let row = 1; row <= 3; row++) {
                const whendo = rv.getWhenDo(col, row)
                if (whendo != -1) {
                    wdCnt++;
                    cmdCnt += rv.getCmdsLen(whendo);
                    attrCnt += rv.attrCnt(whendo);
                }
            }
        }
        return [wdCnt, cmdCnt, attrCnt];
    }

    // TODO: output textual representation to console
    export function packRule(r: Rule, bgLen: number, spLen: number): Buffer {
        // determine vacuous whendo rules (predicate true, no commands)
        const wds = r.whenDo.filter(wd => wd.commandsLen > 0 || !isWhenDoTrue(wd));
        bitIndex = 0;
        let bytes = 2 + wds.length * (2 + (bgLen >> 2) + (spLen >> 2));
        for (let i = 0; i<wds.length; i++) {
            bytes += (wds[i].commandsLen << 1);
        }
        ruleBuf = control.createBuffer(bytes);
        writeBuf(r.ruleType, 4);
        writeBuf(r.ruleArg, 4);
        writeBuf(r.transforms, 4);
        writeBuf(wds.length, 4);    // 2 bytes
        wds.forEach(wd => {
            writeBuf(wd.col, 4);
            writeBuf(wd.row, 4);                // + 1 byte
            writeBufRaw(wd.bgPred, (bgLen >> 2))        // + {1, 2, 3} byte  
            writeBufRaw(wd.spPred, (spLen >> 2));       // + {1, 2, 3} byte
            writeBuf(wd.dir, 4);  
            writeBuf(wd.commandsLen, 4);            // + 1 byte       
        });
        // now, write out the commands
        wds.forEach(wd => {
            if (wd.commandsLen > 0) {
                writeBufRaw(wd.commands, wd.commandsLen << 1);
            }
        });
        return ruleBuf;
    }

    export function unPackRule(buf: Buffer, bgLen: number, spLen: number): Rule {
        ruleBuf = buf;
        bitIndex = 0;
        const rt = readBuf(4);
        const ra = readBuf(4);
        const rv = readBuf(4);
        const rule = new Rule(rt, ra, [], rv);
        const whenDoLen = readBuf(4);
        for(let i = 0; i<whenDoLen; i++) {
            const col = readBuf(4);
            const row = readBuf(4);
            const wd = new WhenDo(col, row,
                    readBufRaw((bgLen >> 2), (bgLen >> 2)),
                    readBufRaw((spLen >> 2), (spLen >> 2)), 
                    -1, 
                    null);
            wd.dir = readBuf(4);
            wd.commandsLen = readBuf(4);
            rule.whenDo.push(wd);
        }
        rule.whenDo.forEach(wd => {
            if (wd.commandsLen > 0) {
                wd.commands = readBufRaw(MaxCommands << 1, wd.commandsLen << 1);
            } else {
                wd.commands = control.createBuffer(MaxCommands << 1);
            }
        });
        return rule;
    }
}