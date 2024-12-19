import type { ImagePiece } from "#types";
import { hash } from "hasha";
import zip from "just-zip-it";
import fs from "node:fs";
import os from "node:os";
import { outdent } from "outdent";
import path from "pathe";
import sharp from "sharp";
import { monorepoDirpath } from "./paths.ts";
// @ts-expect-error: bad typings
import { convert2img } from "mdimg";

export async function generateReadmeMarkdownFile({
  imageWidth,
  darkModeImagePieces,
  lightModeImagePieces,
  lightModeReadmeMdImageFilepath,
  darkModeReadmeMdImageFilepath,
}: {
  imageWidth: number;
  darkModeImagePieces: ImagePiece[];
  lightModeImagePieces: ImagePiece[];
  lightModeReadmeMdImageFilepath: string;
  darkModeReadmeMdImageFilepath: string;
}) {
  // We use GitHub pages to host our static images since it seems like that's more
  // reliable compared to using `raw.githubusercontent.com` URLs.
  const getImagePieceSrc = ({ filepath, imgSrc, theme }: ImagePiece & { theme: "light" | "dark" }) =>
    `https://thien-mdp.github.io/thien-mdp/generator/generated/${
      imgSrc === undefined
        ? path.basename(filepath)
        : imgSrc.replace(
            "${README_MD_SRC}",
            path.basename(theme === "light" ? lightModeReadmeMdImageFilepath : darkModeReadmeMdImageFilepath)
          )
    }`;

  const getImgWidth = (width: number) => `${(width / imageWidth) * 100}%`;

  const readmeFooter = outdent({ trimLeadingNewline: false })`
		###### 👆 The above image is interactive! Try clicking on the tabs :)
	`;

  const readme =
    zip(lightModeImagePieces, darkModeImagePieces)
      .map(([lightModeImagePiece, darkModeImagePiece]) => {
        const { href } = lightModeImagePiece;
        const imgWidth = getImgWidth(lightModeImagePiece.width);
        const lightModeImgSrc = getImagePieceSrc({
          ...lightModeImagePiece,
          theme: "light",
        });
        const darkModeImgSrc = getImagePieceSrc({
          ...darkModeImagePiece,
          theme: "dark",
        });

        const pictureHtml = outdent`
				<picture><source media="(prefers-color-scheme: light)" srcset="${lightModeImgSrc}"><source media="(prefers-color-scheme: dark)" srcset="${darkModeImgSrc}"><img src="${lightModeImgSrc}" width="${imgWidth}" /></picture>
			`;

        const markdown = href === null ? pictureHtml : `<a href="${href}">${pictureHtml}</a>`;

        return markdown;
      })
      .join("") + readmeFooter;

  await fs.promises.writeFile(path.join(monorepoDirpath, "../readme.markdown"), readme);
}

export async function convertReadmeMdToImage({
  imageWidth,
  imageHeight,
  theme,
}: {
  imageWidth: number;
  imageHeight: number;
  theme: "light" | "dark";
}) {
  const img = await convert2img({
    mdFile: path.join(monorepoDirpath, "../README.md"),
    outputFilename: await os.tmpdir(),
    width: imageWidth,
    height: imageHeight,
    cssTemplate: theme === "light" ? "github" : "githubdark",
  });

  const imgHash = await hash(img.data);
  const image = sharp(img.data);
  const { width, height } = await image.metadata();
  if (!width || !height) {
    throw new Error("Could not get image dimensions");
  }

  const readmeMdImageFilepath = path.join(monorepoDirpath, `generated/readme-${theme}.${imgHash}.png`);

  await image
    .resize(369, 230)
    .extract({
      left: 1,
      top: 1,
      width: 369 - 2,
      height: 230 - 2,
    })
    .extend({
      top: 1,
      bottom: 1,
      left: 1,
      right: 1,
      background: theme === "light" ? "#000000" : "#EEEEEE",
    })
    .toFile(readmeMdImageFilepath);

  return readmeMdImageFilepath;
}
