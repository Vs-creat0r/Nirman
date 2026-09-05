/**
 * @fileoverview Embedded TrueType Font Configuration for Vector PDF Generation.
 *
 * Configures base64-embedded Roboto TrueType fonts with full Unicode and
 * Indian Rupee (₹ U+20B9) glyph support for pdfmake.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfsFonts = require("pdfmake/build/vfs_fonts.js");

export const PDF_VFS: Record<string, string> = vfsFonts.pdfMake?.vfs || vfsFonts;

export const PDF_FONTS = {
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
};
