import type { FontStyle, FontWeight } from "satori";
import fs from "node:fs";
import path from "node:path";

export type FontOptions = {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight | undefined;
  style: FontStyle | undefined;
};

async function loadGoogleFont(
  font: string,
  text: string,
  isBold = false
): Promise<ArrayBuffer> {
  const fontName = isBold ? "bold.ttf" : "regular.ttf";
  const localFontPath = path.resolve(
    process.cwd(),
    `src/assets/fonts/${fontName}`
  );
  if (fs.existsSync(localFontPath)) {
    const buffer = fs.readFileSync(localFontPath);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  }

  const API = `https://fonts.googleapis.com/css2?family=${font}&text=${encodeURIComponent(text)}`;

  const css = await (
    await fetch(API, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
      },
    })
  ).text();

  const resource = css.match(
    /src: url\((.+)\) format\('(opentype|truetype)'\)/
  );

  if (!resource) throw new Error("Failed to download dynamic font");

  const res = await fetch(resource[1]);

  if (!res.ok) {
    throw new Error("Failed to download dynamic font. Status: " + res.status);
  }

  const fonts: ArrayBuffer = await res.arrayBuffer();
  return fonts;
}

async function loadGoogleFonts(
  text: string
): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>
> {
  const fontsConfig = [
    {
      name: "IBM Plex Mono",
      font: "IBM+Plex+Mono",
      weight: 400,
      style: "normal",
      isBold: false,
    },
    {
      name: "IBM Plex Mono",
      font: "IBM+Plex+Mono:wght@700",
      weight: 700,
      style: "bold",
      isBold: true,
    },
  ];

  const fonts = await Promise.all(
    fontsConfig.map(async ({ name, font, weight, style, isBold }) => {
      const data = await loadGoogleFont(font, text, isBold);
      return { name, data, weight, style };
    })
  );

  return fonts;
}

export default loadGoogleFonts;
