// Tiny QR generator (qrcode-generator: no deps). QR codes cap out well below a
// full library, so callers render a QR only when the code fits and otherwise fall
// back to the copyable text. ~2200 chars is a practical scan limit at readable
// density.
import qrcode from 'qrcode-generator';

export const MAX_QR_CHARS = 2200;

// Returns an <svg> string for `text`, or null if it is too large to encode/scan.
export const makeQrSvg = (text: string | null | undefined): string | null => {
    if (!text || text.length > MAX_QR_CHARS) return null;
    try {
        const qr = qrcode(0, 'L'); // 0 = auto version, L = most data capacity
        qr.addData(text);
        qr.make();
        return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) {
        return null; // exceeded the largest QR version
    }
};
