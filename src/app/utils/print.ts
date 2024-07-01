import {getDPI, mm2px} from "@lucilor/utils";
import {toPng} from "html-to-image";
import {TDocumentInformation} from "pdfmake/interfaces";

export const getPrintInfo = (mmWidth: number, mmHeight: number) => {
  const [dpiX, dpiY] = getDPI();
  const factor = 0.75;
  const width = mm2px(mmWidth, dpiX) * factor;
  const height = mm2px(mmHeight, dpiY) * factor;
  const scaleX = 300 / dpiX / factor;
  const scaleY = 300 / dpiY / factor;
  const scale = Math.sqrt(scaleX * scaleY);
  return {width, height, scaleX, scaleY, scale, factor};
};

export const getPdfInfo = (others?: TDocumentInformation): TDocumentInformation => {
  const now = new Date();
  return {
    title: "noname",
    author: "Lucilor",
    subject: "Lucilor",
    creator: "Lucilor",
    producer: "Lucilor",
    creationDate: now,
    modDate: now,
    ...others
  };
};

export const htmlToPng = async (el: HTMLElement, mmWidth: number, mmHeight: number) => {
  const info = getPrintInfo(mmWidth, mmHeight);
  const {width, height, scaleX, scaleY, factor} = info;
  const png = await toPng(el, {
    width: (width * scaleX) / factor,
    height: (height * scaleY) / factor,
    style: {margin: "0", transform: `scale(${scaleX},${scaleY})`, transformOrigin: "top left"}
  });
  return {png, info};
};
