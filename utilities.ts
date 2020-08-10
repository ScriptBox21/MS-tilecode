namespace tileworld {

    const zeroCode = "0".charCodeAt(0);

    export function getHelp(help: string, col: number, row: number): string {
        if (!help)
            return null;
        let index = 0;
        while (index >= 0 && index < help.length) {
            const curr = index;
            const nextCol = help.substr(curr, 1).charCodeAt(0) - zeroCode;
            const nextRow = help.substr(curr + 1, 1).charCodeAt(0) - zeroCode;
            const comma = help.indexOf(",", index);
            if (nextCol == col && nextRow == row)
                return help.substr(curr + 2, comma - curr - 2);
            index = comma + 1;
        }
        return null;
    }

    export function cursorAnimation(cursor: Sprite, second: Image): void {
        const anim = animation.createAnimation(0, 300);
        anim.addAnimationFrame(cursor.image);
        anim.addAnimationFrame(second);
        animation.attachAnimation(cursor, anim)
        animation.setAction(cursor, 0)
    }

    // cache these???
    export function greyImage(img: Image): Image {
        const ret: Image = img.clone();
        for(let x=0; x<ret.width; x++) {
            for (let y = 0; y < ret.height; y++) {
                const pix = ret.getPixel(x,y);
                ret.setPixel(x,y,pix == 0 ? 0 : 12)
            }
        }
        return ret;
    }

    export function splitImage(imgLeft: Image, imgRight: Image): Image {
        const ret: Image = imgLeft.clone();
        for(let x=(ret.width>>1); x<ret.width; x++) {
            for (let y = 0; y < ret.height; y++) {
                ret.setPixel(x,y,imgRight.getPixel(x,y));
            }
        }
        return ret;
    }

    export function drawHalfSize(img: Image, nx: number, ny: number, transparent = false): void {
        if (!transparent) {
            for (let i = 0; i < img.width; i += 2) {
                for (let j = 0; j < img.height; j += 2) {
                    screen.setPixel(nx + (i >> 1), ny + (j >> 1), img.getPixel(i, j))
                }
            }
        } else {
            for (let i = 0; i < img.width; i += 2) {
                for (let j = 0; j < img.height; j += 2) {
                    const pix = img.getPixel(i,j);
                    if (pix)
                        screen.setPixel(nx + (i >> 1), ny + (j >> 1), pix);
                }
            }        
        }
    }

    export function imageToBuffer(img: Image): Buffer {
        // worst case = 1 byte per pixel
        const buf = control.createBuffer(2 + (img.width * img.height));
        let index = 0;
        buf.setNumber(NumberFormat.Int8LE, index++, img.width);
        buf.setNumber(NumberFormat.Int8LE, index++, img.height);
        let pixel = 17;
        let length = 0;
        for(let x = 0; x < img.width; x++) {
            for (let y = 0; y < img.height; y++) {
                const newPixel = img.getPixel(x, y);
                if (newPixel != pixel) {
                    if (length > 0) {
                        // output run
                        buf.setUint8(index++, ((length & 0xf) << 4) | (pixel & 0xf));
                    }
                    // start new run
                    pixel = newPixel;
                    length = 1;
                } else {
                    if (length == 14) {
                        // output run
                        buf.setUint8(index++, 0xf0 | (pixel & 0xf));
                        // reset
                        pixel = 17;
                        length = 0;
                    } else {
                        length++;
                    }
                }
            }
        }
        // last bit (if needed)
        if (length > 0) {
            buf.setUint8(index++, ((length & 0xf) << 4) | (pixel & 0xf));
        }
        // return exactly the amount used. 
        return buf.slice(0, index);
    }

    export function bufferToImage(buf: Buffer): Image {
        const width = buf.getNumber(NumberFormat.Int8LE, 0);
        const height = buf.getNumber(NumberFormat.Int8LE, 1);
        let index = 2;
        const img = image.create(width, height);
        let x = 0;
        let y = 0;
        while (index < buf.length) {
            const pair = buf.getUint8(index++);
            const pixel = pair & 0xf;
            let len = (pair & 0xf0) >> 4;
            while (len > 0) {
                img.setPixel(x, y, pixel);
                if (y == height -1 ) { x++; y = 0; } else { y++; }
                len--;
            }
        }
        control.assert(index == buf.length, 54);
        return img;
    }
}