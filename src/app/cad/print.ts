import {getOrderBarcode, replaceRemoteHost} from "@app/app.common";
import {getPdfInfo, getPrintInfo} from "@app/utils/print";
import {
  CadCircle,
  CadData,
  CadDimension,
  CadDimensionLinear,
  CadEntities,
  CadEntity,
  CadImage,
  CadLeader,
  CadLine,
  CadLineLike,
  CadMtext,
  CadViewer,
  CadViewerConfig,
  Defaults,
  FontStyle,
  setLinesLength
} from "@lucilor/cad-viewer";
import {getImageDataUrl, isBetween, isNearZero, isTypeOf, loadImage, Matrix, ObjectOf, Point, Rectangle, timeout} from "@lucilor/utils";
import {cloneDeep, intersection} from "lodash";
import {createPdf} from "pdfmake/build/pdfmake";
import QRCode from "qrcode";
import {getCadPreview} from "./cad-preview";
import {
  BomTable,
  DrawDesignPicsParams,
  PdfDocument,
  PrintCadsParams,
  PrintCadsParamsOrder,
  型材物料明细,
  型材物料明细Item
} from "./print.types";
import {
  getCadCalcZhankaiText,
  getShuangxiangLineRects,
  maxLineLength,
  prepareCadViewer,
  setShuangxiangLineRects,
  showIntersections,
  splitShuangxiangCad
} from "./utils";

const findRectLines = (data: CadData, keyword: string, findLocator: boolean) => {
  const rectData = data.getBoundingRect();
  const rect = rectData.clone();
  const vLines: CadLine[] = [];
  const hLines: CadLine[] = [];
  data.entities.line.forEach((e) => {
    if (e.isVertical()) {
      vLines.push(e);
    } else if (e.isHorizontal()) {
      hLines.push(e);
    }
  });
  const result = {
    locator: null as CadMtext | null,
    rect,
    lines: {
      top: null as CadLine | null,
      right: null as CadLine | null,
      bottom: null as CadLine | null,
      left: null as CadLine | null
    },
    errors: [] as string[]
  };
  if (vLines.length < 1) {
    result.errors.push("模板没有垂直线");
  }
  if (hLines.length < 1) {
    result.errors.push("模板没有水平线");
  }
  if (result.errors.length > 0) {
    return result;
  }
  vLines.sort((a, b) => a.start.x - b.start.x);
  hLines.sort((a, b) => a.start.y - b.start.y);

  if (findLocator) {
    const locator = data.entities.mtext.find((e) => e.text === `#${keyword}#`);
    if (!locator) {
      result.errors.push("没有找到标识");
      return result;
    }
    const {
      left: locatorLeft,
      right: locatorRight,
      top: locatorTop,
      bottom: locatorBottom,
      width: locatorWidth,
      height: locatorHeight
    } = locator.boundingRect;
    result.locator = locator;
    const leftLines: CadLine[] = [];
    const rightLines: CadLine[] = [];
    const topLines: CadLine[] = [];
    const bottomLines: CadLine[] = [];
    vLines.forEach((e) => {
      if (e.length < locatorHeight) {
        return;
      }
      if (e.maxY < locatorBottom || e.minY > locatorTop) {
        return;
      }
      if (e.minX < locatorLeft) {
        leftLines.push(e);
      }
      if (e.maxX > locatorRight) {
        rightLines.push(e);
      }
    });
    hLines.forEach((e) => {
      if (e.length < locatorWidth) {
        return;
      }
      if (e.maxX < locatorLeft || e.minX > locatorRight) {
        return;
      }
      if (e.minY < locatorTop) {
        bottomLines.push(e);
      }
      if (e.maxY > locatorBottom) {
        topLines.push(e);
      }
    });
    const instersects = (e: CadLine, es: CadLine[]) => es.some((e2) => e.curve.intersects(e2.curve).length > 0);
    const leftLines2 = leftLines.filter((e) => instersects(e, topLines) || instersects(e, bottomLines));
    const rightLines2 = rightLines.filter((e) => instersects(e, topLines) || instersects(e, bottomLines));
    const topLines2 = topLines.filter((e) => instersects(e, leftLines) || instersects(e, rightLines));
    const bottomLines2 = bottomLines.filter((e) => instersects(e, leftLines) || instersects(e, rightLines));
    result.lines.top = topLines2.at(0) || null;
    result.lines.right = rightLines2.at(0) || null;
    result.lines.bottom = bottomLines2.at(-1) || null;
    result.lines.left = leftLines2.at(-1) || null;
    if (!result.lines.top || !result.lines.right || !result.lines.bottom || !result.lines.left) {
      result.errors.push("没有足够的线");
      return result;
    }
    rect.left = result.lines.left.minX;
    rect.right = result.lines.right.maxX;
    rect.top = result.lines.top.minY;
    rect.bottom = result.lines.bottom.maxY;
  } else {
    rect.left = vLines[0].start.x;
    rect.right = vLines[vLines.length - 1].start.x;
    const vLinesMinLength = rect.height / 2;
    const vLines2 = vLines.filter((e) => e.length > vLinesMinLength);
    const vLinesDx = vLines2[vLines2.length - 1].start.x - vLines2[0].start.x;
    const hLines2 = hLines.filter((e) => isNearZero(e.length - vLinesDx, 1)).reverse();
    if (hLines2.length < 1) {
      result.errors.push("模板没有合适的线");
      return result;
    }
    for (let i = 0; i < hLines2.length - 1; i++) {
      const l1 = hLines2[i];
      const l2 = hLines2[i + 1];
      if (l1.start.y - l2.start.y > 500) {
        rect.top = l1.start.y;
        break;
      }
    }
    rect.bottom = hLines2[hLines2.length - 1].start.y;
  }
  return {...result};
};

const imgMap: ObjectOf<string> = {};
const setImageUrl = async (cadImage: CadImage, url: string) => {
  const url2 = replaceRemoteHost(url);
  if (url2 in imgMap && imgMap[url2]) {
    cadImage.url = imgMap[url2];
  } else {
    try {
      const image = await loadImage(url2);
      cadImage.url = getImageDataUrl(image);
      cadImage.sourceSize = new Point(image.width, image.height);
      imgMap[url2] = cadImage.url;
    } catch {
      imgMap[url2] = "";
    }
  }
};
const setImagesUrl = (cadImages: CadImage[], urls: string[]) => {
  return Promise.all(cadImages.map((e, i) => setImageUrl(e, urls[i])));
};

const drawDesignPics = async (
  data: CadData,
  keyword: string,
  num: number,
  findLocator: boolean,
  rect: Rectangle,
  params: DrawDesignPicsParams = {}
): Promise<CadImage[] | null> => {
  const {margin, anchorBg, anchorImg, objectFit, flip}: Required<DrawDesignPicsParams> = {
    margin: 0,
    anchorBg: [0.5, 0.5],
    anchorImg: [0.5, 0.5],
    objectFit: "contain",
    flip: "",
    ...params
  };
  const flip2 = flip?.toLocaleLowerCase() || "";

  const {width, height, top, bottom, left, right} = rect;
  if (!findLocator) {
    data.entities = data.entities.filter((e) => {
      if (e instanceof CadMtext) {
        return !isBetween(e.insert.y, top, bottom);
      }
      if (e instanceof CadLine) {
        if (e.minX >= right || e.maxX <= left) {
          return true;
        }
        if (e.isHorizontal()) {
          return e.minY >= top || e.maxY <= bottom;
        } else if (e.isVertical()) {
          if (e.maxY > top || e.minY < bottom) {
            return true;
          }
          if (e.maxY === top || e.minY === bottom) {
            return e.minX <= left || e.maxX >= right;
          }
          return false;
        }
      }
      const eRect = e.boundingRect;
      return eRect.left > right || eRect.right < left || eRect.top < bottom || eRect.bottom > top;
    });
  }

  let imgWidth: number;
  let imgHeight: number;
  let getImgRect: (i: number) => Rectangle;
  if (width > height) {
    imgWidth = width / num - margin * 2;
    imgHeight = height - margin * 2;
    getImgRect = (i) => {
      const imgBottom = bottom + margin;
      const imgTop = top - margin;
      const imgLeft = left + margin + (imgWidth + margin * 2) * i;
      const imgRight = imgLeft + imgWidth;
      return new Rectangle([imgLeft, imgBottom], [imgRight, imgTop]);
    };
  } else {
    imgWidth = width - margin * 2;
    imgHeight = height / num - margin * 2;
    getImgRect = (i) => {
      const imgBottom = bottom + margin + (imgHeight + margin * 2) * i;
      const imgTop = imgBottom + imgHeight;
      const imgLeft = left + margin;
      const imgRight = right - margin;
      return new Rectangle([imgLeft, imgBottom], [imgRight, imgTop]);
    };
  }

  const cadImages: CadImage[] = [];
  for (let i = 0; i < num; i++) {
    const cadImage = new CadImage();
    if (findLocator) {
      cadImage.anchor.set(anchorImg[0], anchorImg[1]);
    } else {
      cadImage.anchor.set(0.5, 0.5);
    }
    cadImage.position = getImgRect(i).getPoint(anchorBg[0], anchorBg[1]);
    cadImage.targetSize = new Point(imgWidth, imgHeight);
    cadImage.objectFit = objectFit;
    cadImage.info.designPicKey = keyword;
    const matrix = new Matrix();
    if (flip2.includes("h")) {
      matrix.scale(-1, 1);
    } else if (flip2.includes("v")) {
      matrix.scale(1, -1);
    }
    cadImage.transform(matrix, true);
    data.entities.add(cadImage);
    cadImages.push(cadImage);
  }
  return cadImages;
};

interface GetWrapedTextOptions {
  maxLength: number;
  minLength?: number;
  indent?: number;
  separator?: string | RegExp;
}
const getWrapedTextOptions = (source: string, maxLength: number) => {
  const options: GetWrapedTextOptions = {maxLength};
  if (source.match(/(\d+(\.\d+)?)?[x×](\d+(\.\d+)?)?/)) {
    options.minLength = 1;
    options.indent = 4;
    options.separator = /[,，。:；]/;
  }
  return options;
};
const getWrapedText = (cad: CadViewer, source: string, mtext: CadMtext, options: GetWrapedTextOptions) => {
  const defaultOptions: Required<GetWrapedTextOptions> = {
    maxLength: 0,
    minLength: 0,
    indent: 0,
    separator: ""
  };
  const {maxLength, minLength, indent, separator} = {...defaultOptions, ...options};
  const sourceLength = source.length;
  let start = 0;
  let end = 1;
  const tmpText = mtext.clone(true);
  tmpText.text = source;
  cad.add(tmpText);
  const arr: string[] = [];
  const getIndentText = (t: string) => {
    if (indent > 0 && arr.length > 0) {
      return Array(indent).fill(" ").join("") + t;
    }
    return t;
  };
  while (end <= sourceLength) {
    tmpText.text = getIndentText(source.slice(start, end));
    cad.render(tmpText);
    if (tmpText.el && Number(tmpText.el.width()) < maxLength) {
      end++;
    } else {
      if (start === end - 1) {
        throw new Error("文字自动换行时出错");
      }
      let text = source.slice(start, end - 1);
      const text2 = source.slice(end - 1);
      if (text2.length <= minLength) {
        break;
      }
      if (separator) {
        for (let i = end - 2; i >= start; i--) {
          if (source[i].match(separator)) {
            end = i + 2;
            text = source.slice(start, end - 1);
            break;
          }
        }
      }
      arr.push(getIndentText(text));
      start = end - 1;
    }
  }
  arr.push(getIndentText(source.slice(start)));
  cad.remove(tmpText);
  return arr;
};

export const configCadDataForPrint = async (
  cad: CadViewer,
  data: CadData | CadEntities | CadEntity[] | CadEntity,
  params: PrintCadsParams,
  zxpjConfig?: {isZxpj: true; lineLengthFontStyle?: FontStyle; 使用显示线长?: boolean}
) => {
  const linewidth = params.linewidth || 1;
  const dimStyle = params.dimStyle;
  const config = cad.getConfig();
  const textMap = params.textMap || {};
  const {isZxpj, lineLengthFontStyle, 使用显示线长} = zxpjConfig || {};

  const getConfigBefore = (e: CadEntity) => {
    if (!e.info.configBefore) {
      e.info.configBefore = {};
    }
    return e.info.configBefore;
  };
  const configDimension = (e: CadDimension, colorNumber: number) => {
    e.linewidth = linewidth;
    e.setStyle({
      ...dimStyle,
      dimensionLine: {color: "#505050", dashArray: Defaults.DASH_ARRAY},
      extensionLines: {color: "#505050", length: 12},
      arrows: {color: "#505050"}
    });
    if (colorNumber === 0xff00ff || e.layer === "门扇中间宽标注") {
      e.setStyle({arrows: {hidden: true}});
    }
  };
  const configMText = (e: CadMtext) => {
    const {text, insert} = e;
    const offsetInsert = (x: number, y: number) => {
      const configBefore = getConfigBefore(e);
      const insertOffsetBefore = configBefore.insertOffset;
      if (insertOffsetBefore) {
        insert.x += insertOffsetBefore[0] - x;
        insert.y += insertOffsetBefore[1] - y;
      } else {
        configBefore.insertOffset = [x, y];
        insert.x += x;
        insert.y += y;
      }
    };
    const offsetFontSize = (size: number) => {
      const configBefore = getConfigBefore(e);
      if (typeof configBefore.fontSize === "number") {
        e.fontStyle.size = configBefore.fontSize + size;
      } else if (typeof e.fontStyle.size === "number") {
        configBefore.fontSize = e.fontStyle.size;
        e.fontStyle.size += size;
      }
    };

    if ((isZxpj || e.text.includes("     ")) && !isNaN(Number(e.text))) {
      if (e.fontStyle.size === 24) {
        offsetInsert(3, -7);
      } else if (e.fontStyle.size === 22) {
        offsetInsert(3, -7);
      }
      e.text = text.replace("     ", "");
      e.fontStyle.family = "仿宋";
      e.fontStyle.weight = "bolder";
      offsetFontSize(8);
    } else {
      if (config.fontStyle?.family === "宋体") {
        offsetFontSize(6);
        offsetInsert(0, -5);
      } else {
        offsetInsert(0, -12);
      }
    }
    if ((e.fontStyle.size || -1) < 24) {
      e.fontStyle.weight = "bolder";
    }
    if ([" ×  = 1", "=1"].includes(e.text)) {
      e.visible = false;
    }

    // * 自动换行
    const wrapedTextMatch = text.match(/^(花件信息|自动换行)/);
    if (wrapedTextMatch) {
      let wrapedText = text.slice(wrapedTextMatch[0].length);
      let lines = es.line;
      lines = lines.filter((ee) => ee.isVertical() && isBetween(insert.y, ee.minY, ee.maxY) && ee.start.x - insert.x > 50);
      let dMin = Infinity;
      for (const ee of lines) {
        const d = ee.start.x - insert.x - 1;
        if (dMin > d) {
          dMin = d;
        }
      }
      dMin += 8;
      try {
        wrapedText = wrapedText
          .split("\n")
          .map((v) => getWrapedText(cad, v, e, getWrapedTextOptions(v, dMin)).join("\n"))
          .join("\n");
      } catch (error) {
        console.warn("自动换行时出错");
        console.warn(error);
      }
      e.text = wrapedText;
    }

    if (e.text in textMap) {
      e.text = textMap[e.text];
    }
  };
  const configLine = (e: CadLineLike, colorNumber: number) => {
    if (isZxpj || colorNumber === 0x333333 || e.layer !== "0") {
      e.linewidth = linewidth;
    }
  };

  if (isZxpj && data instanceof CadData) {
    const lineLengthMap: ObjectOf<{text: string; mtext: CadMtext; 显示线长?: string}> = {};
    const shaungxiangCads = splitShuangxiangCad(data);
    const shaungxiangRects = getShuangxiangLineRects(shaungxiangCads);
    await cad.render(data.getAllEntities());
    let rect2 = data.entities.filter((e) => e instanceof CadLineLike).getBoundingRect(false);
    const 宽度标注文本 = Math.round(rect2.width).toFixed();
    data.entities.forEach((e) => {
      if (e instanceof CadLineLike) {
        if (!e.hideLength) {
          const mtext = e.children.mtext.find((ee) => ee.info.isLengthText);
          if (mtext) {
            lineLengthMap[e.id] = {text: mtext.text, mtext, 显示线长: e.显示线长};
          }
        }
        const length = e.length;
        if (e instanceof CadLine && length > maxLineLength * data.suanliaodanZoom) {
          setLinesLength(data, [e], maxLineLength);
        }
      }
    });
    let rect = data.getBoundingRect();
    // data.transform({scale: data.suanliaodanZoom, origin: [rect.x, rect.y]}, true);
    await cad.render(data.getAllEntities());
    setShuangxiangLineRects(shaungxiangCads, shaungxiangRects);
    await cad.render(data.getAllEntities());
    data.entities.toArray().forEach((e) => {
      if (e instanceof CadLineLike && e.id in lineLengthMap) {
        e.hideLength = true;
        const {text, mtext, 显示线长} = lineLengthMap[e.id];
        const mtext2 = mtext.clone(true);
        delete mtext2.info.isLengthText;
        if (使用显示线长 && 显示线长) {
          mtext2.text = 显示线长;
        } else {
          mtext2.text = text;
        }
        if (lineLengthFontStyle) {
          mtext2.fontStyle = cloneDeep(lineLengthFontStyle);
        }
        data.entities.add(mtext2);
      }
    });
    showIntersections(data, params.projectConfig);
    await cad.render(data.getAllEntities());

    const 宽度标注 = data.entities.dimension.find((e) => e instanceof CadDimensionLinear && e.info.宽度标注);
    if (data.showKuandubiaozhu) {
      let 宽度标注2: CadDimensionLinear;
      if (宽度标注 instanceof CadDimensionLinear) {
        宽度标注2 = 宽度标注;
      } else {
        宽度标注2 = new CadDimensionLinear();
        data.entities.add(宽度标注2);
        宽度标注2.info.宽度标注 = true;
      }
      rect = data.getBoundingRect();
      rect2 = data.entities.filter((e) => e instanceof CadLineLike).getBoundingRect();
      rect2.top = rect.top;
      const space = 20;
      宽度标注2.defPoints = [new Point(rect2.left, rect2.top + space), new Point(rect2.left, rect2.top), new Point(rect2.right, rect2.top)];
      宽度标注2.mingzi = 宽度标注文本;
      configDimension(宽度标注2, 0);
    } else if (宽度标注) {
      cad.remove(宽度标注);
    }
    await cad.render(data.getAllEntities());
  }

  let es: CadEntities;
  if (data instanceof CadData) {
    es = data.entities;
  } else if (data instanceof CadEntities) {
    es = data;
  } else if (Array.isArray(data)) {
    es = new CadEntities(data);
  } else {
    es = new CadEntities([data]);
  }
  for (const e of es.toArray()) {
    const colorNumber = e.getColor().rgbNumber();
    if (e instanceof CadLineLike) {
      configLine(e, colorNumber);
    } else if (e instanceof CadDimension) {
      configDimension(e, colorNumber);
    } else if (e instanceof CadMtext) {
      configMText(e);
    }
    if (colorNumber === 0x808080 || ["开料额外信息", "不显示"].includes(e.layer)) {
      e.visible = false;
    } else if (e.layer === "分体") {
      if (e instanceof CadCircle) {
        e.linewidth = Math.max(1, e.linewidth - 1);
        e.setColor("blue");
        e.dashArray = [10, 3];
      }
    } else if (![0xff0000, 0x0000ff].includes(colorNumber)) {
      e.setColor(0);
    }
  }
};

const getUnfoldCadViewers = async (
  params: PrintCadsParams,
  config: CadViewerConfig,
  size: [number, number],
  i: number,
  unfold: NonNullable<PrintCadsParamsOrder["unfold"]>
) => {
  const ratio = size[0] / size[1];
  const rowNum = ratio > 1 ? 2 : 3;
  const colNum = 3;
  const maxSize = rowNum * colNum;
  if (unfold.length > maxSize) {
    let result: string[] = [];
    for (let j = 0; j < unfold.length; j += maxSize) {
      result = result.concat(await getUnfoldCadViewers(params, config, size, i, unfold.slice(j, j + maxSize)));
    }
    return result;
  }

  if (unfold.length < 1) {
    return [];
  }

  const [width, height] = size;
  const unfoldCad = new CadData();
  const unfoldCadViewer = new CadViewer(unfoldCad, {...config, hideLineLength: false, hideDimensions: true}).appendTo(document.body);
  const topLine = new CadLine({start: [0, height], end: [width, height]});
  const rightLine = new CadLine({start: [width, height], end: [width, 0]});
  const bottomLine = new CadLine({start: [width, 0], end: [0, 0]});
  const leftLine = new CadLine({start: [0, 0], end: [0, height]});
  const boundingLines = [topLine, bottomLine, leftLine, rightLine];
  for (const e of boundingLines) {
    e.opacity = 0;
    unfoldCad.entities.add(e);
  }

  const titleFontStyle: FontStyle = {size: 16} as const;
  const infoTextFontStyle: FontStyle = {size: 12} as const;
  const boxPadding = [5, 5, 5, 5] as const;
  const imgPadding = [5, 5, 5, 5] as const;
  const textMargin = 5 as const;

  const code = params.codes?.[i] || "";
  const titleText = new CadMtext({text: "刨坑生产单", anchor: [0, 0], fontStyle: titleFontStyle});
  const codeText = new CadMtext({text: `订单编号: ${code}`, anchor: [1, 0], fontStyle: titleFontStyle});
  titleText.insert.set(0, height);
  codeText.insert.set(width, height);
  unfoldCad.entities.add(titleText, codeText);
  await unfoldCadViewer.render(titleText);
  const titleHeight = titleText.boundingRect.height;

  const contentWidth = width;
  const contentHeight = height - titleHeight - 5;
  const boxWidth = contentWidth / colNum;
  const boxHeight = contentHeight / rowNum;
  for (let j = 0; j < rowNum; j++) {
    const y = (j + 1) * boxHeight;
    const rowLine = new CadLine({start: [0, y], end: [width, y]});
    unfoldCad.entities.add(rowLine);
  }
  for (let j = 0; j < colNum - 1; j++) {
    const x = (j + 1) * boxWidth;
    const colLine = new CadLine({start: [x, 0], end: [x, contentHeight]});
    unfoldCad.entities.add(colLine);
  }
  const materialResult = params.orders?.[i]?.materialResult || {};
  const projectName = params.projectName || "";
  const barcodeEl = new Image();
  barcodeEl.id = "tmp-bar-code";
  document.body.appendChild(barcodeEl);
  const qrcodeEl = document.createElement("canvas");
  const useQrcode = params.projectConfig.getBoolean("刨坑工单生成新代系统二维码");
  let isBarcodeFailed = false;
  const barcodeSize = [2, 40];
  const qrcodeWidth = 60;
  await timeout(0);

  const addText = async (text: string, insert: [number, number], opts?: {anchor?: [number, number]; fontStyle?: FontStyle}) => {
    const {anchor, fontStyle} = opts || {};
    const mtext = new CadMtext({text, insert, anchor, fontStyle});
    unfoldCad.entities.add(mtext);
    await unfoldCadViewer.render(mtext);
    return mtext;
  };

  for (const [j, {cad, offsetStrs}] of unfold.entries()) {
    const rowIndex = rowNum - Math.floor(j / colNum);
    const colIndex = j % colNum;
    const boxRect = new Rectangle();
    boxRect.min.set(colIndex * boxWidth + boxPadding[3], (rowIndex - 1) * boxHeight + boxPadding[2]);
    boxRect.max.set((colIndex + 1) * boxWidth - boxPadding[1], rowIndex * boxHeight - boxPadding[0]);
    await configCadDataForPrint(unfoldCadViewer, cad, params, {isZxpj: true, lineLengthFontStyle: {size: 10}, 使用显示线长: true});
    const calcZhankai = cad.info.calcZhankai || [];
    const bancai = cad.info.bancai || {};

    let y = boxRect.bottom + textMargin;
    if (!useQrcode && !isBarcodeFailed) {
      const barcodeText = `${code}-${cad.numId}`;
      const barcodeResult = getOrderBarcode(barcodeEl, {
        text: `${code}-${cad.numId}`,
        displayValue: false,
        margin: 0,
        width: 2,
        height: 30
      });
      if (barcodeResult.error) {
        const msg = barcodeResult.error;
        console.warn(msg);
        isBarcodeFailed = true;
        const mtext = await addText("生成条形码出错：" + msg, [boxRect.left, y], {anchor: [0, 1], fontStyle: infoTextFontStyle});
        y += mtext.boundingRect.height + textMargin;
      }
      if (!isBarcodeFailed) {
        const mtext = await addText(barcodeText, [boxRect.x, y], {anchor: [0.5, 1], fontStyle: infoTextFontStyle});
        y += mtext.boundingRect.height + imgPadding[2];
        const img = new CadImage();
        img.objectFit = "contain";
        img.anchor.set(0.5, 1);
        img.targetSize = new Point(boxRect.width - imgPadding[1] - imgPadding[3], barcodeSize[1]);
        img.url = barcodeEl.src;
        img.position.set(boxRect.x, y);
        unfoldCad.entities.add(img);
        await unfoldCadViewer.render(img);
        y += img.boundingRect.height + imgPadding[0];
      }
    } else {
      const qrcodeText = offsetStrs.join(";");
      if (qrcodeText) {
        let qrcodeSuccess = true;
        try {
          await QRCode.toCanvas(qrcodeEl, qrcodeText, {width: qrcodeWidth, margin: 0});
        } catch (error) {
          console.warn("生成二维码出错", error);
          qrcodeSuccess = false;
        }
        if (qrcodeSuccess) {
          const img = new CadImage();
          img.objectFit = "contain";
          img.anchor.set(0.5, 1);
          img.targetSize = new Point(qrcodeEl.width - imgPadding[1] - imgPadding[3], qrcodeEl.height - imgPadding[0] - imgPadding[2]);
          img.url = qrcodeEl.toDataURL();
          img.position.set(boxRect.x, y);
          unfoldCad.entities.add(img);
          await unfoldCadViewer.render(img);
          y += img.boundingRect.height + imgPadding[0];
        }
      }
    }

    const zhankaiText = getCadCalcZhankaiText(cad, calcZhankai, materialResult, bancai, params.projectConfig.getRaw(), projectName);
    const texts0 = [zhankaiText].concat(offsetStrs);
    const texts: string[] = [];
    for (const text of texts0) {
      const texts1 = text.split(/\n{2,}/);
      texts.push(...texts1);
    }
    texts.reverse();
    const textWidth = boxRect.width;
    for (const text of texts) {
      if (!text) {
        continue;
      }
      const mtext = await addText(text, [boxRect.left, y], {anchor: [0, 1], fontStyle: infoTextFontStyle});
      mtext.text = getWrapedText(unfoldCadViewer, text, mtext, {maxLength: textWidth, separator: /\+-/}).join("\n");
      await unfoldCadViewer.render(mtext);
      y += mtext.boundingRect.height + textMargin;
      mtext.calcBoundingRect = false;
    }

    const imgRect = boxRect.clone();
    imgRect.top -= imgPadding[0];
    imgRect.right -= imgPadding[1];
    imgRect.bottom = y + imgPadding[2];
    imgRect.left += imgPadding[3];
    unfoldCad.entities.merge(cad.entities);
    await unfoldCadViewer.render(cad.entities);
    const cadRect = cad.getBoundingRect();
    const dx = imgRect.x - cadRect.x;
    const dy = imgRect.y - cadRect.y;
    const scale = Math.min(1, imgRect.width / cadRect.width, imgRect.height / cadRect.height);
    cad.transform({translate: [dx, dy], scale, origin: [cadRect.x, cadRect.y]}, true);

    const startLines = [];
    cad.entities.forEach((e) => {
      if (e instanceof CadLineLike && e.info.startLine) {
        startLines.push(e);
        const leader = new CadLeader();
        leader.setColor("red");
        const to = e.start.clone().add(-1, 1);
        const from = to.clone().add(-10, 10);
        leader.vertices = [to, from];
        unfoldCad.entities.add(leader);
        const text = new CadMtext();
        text.insert.copy(from);
        text.setColor("red");
        text.text = "刨坑起点";
        text.fontStyle.size = 8;
        text.anchor.set(0.5, 1);
        unfoldCad.entities.add(text);
      }
    });
  }
  document.body.removeChild(barcodeEl);

  await unfoldCadViewer.render();
  unfoldCadViewer.center();
  const unfoldCadImg = await unfoldCadViewer.toDataURL();
  unfoldCadViewer.destroy();
  return [unfoldCadImg];
};

const getBomTableImgs = async (bomTable: BomTable, config: CadViewerConfig, size: [number, number]) => {
  const viewer = new CadViewer(new CadData(), config);
  const rowSpace = 5;
  const pointer: [number, number] = [0, size[1]];
  const title = new CadMtext({insert: pointer, anchor: [0, 0]});
  title.text = bomTable.title;
  title.fontStyle.size = 20;
  await viewer.add(title);
  pointer[1] -= title.boundingRect.height + rowSpace;

  const imgs: string[] = [];
  const nextPage = async (finished?: boolean) => {
    const baseLine = new CadLine({start: [0, 0], end: size});
    baseLine.visible = false;
    baseLine.calcBoundingRectForce = true;
    await viewer.add(baseLine);
    viewer.center();
    imgs.push(await viewer.toDataURL());
    if (finished) {
      viewer.destroy();
    } else {
      viewer.reset(new CadData());
      pointer[0] = 0;
      pointer[1] = size[1];
    }
  };

  const colWidths: number[] = [];
  for (const col of bomTable.cols) {
    colWidths.push(col.width || 0);
  }
  const sum = colWidths.reduce((a, b) => a + b, 0);
  const zeros = colWidths.filter((v) => v === 0).length;
  const otherWidth = (size[0] - sum) / zeros;
  for (const [i, w] of colWidths.entries()) {
    if (w === 0) {
      colWidths[i] = otherWidth;
    }
  }
  const getText = (value: any) => {
    if (isTypeOf(value, ["null", "undefined"])) {
      return "";
    } else if (isTypeOf(value, "string")) {
      return value;
    } else {
      return String(value);
    }
  };
  const addRow = async (addDivider: boolean, rowData?: ObjectOf<any>) => {
    let maxTextHeight = 0;
    for (const [i, col] of bomTable.cols.entries()) {
      const mtext = new CadMtext({insert: pointer, anchor: [0, 0]});
      if (rowData) {
        if (col.link) {
          mtext.text = getText(col.link[rowData[col.field]]);
        } else {
          mtext.text = getText(rowData[col.field]);
        }
      } else {
        mtext.text = col.label || col.field;
      }
      mtext.fontStyle.size = 12;
      await viewer.add(mtext);
      const rect = mtext.boundingRect;
      maxTextHeight = Math.max(maxTextHeight, rect.height);
      pointer[0] += colWidths[i];
    }
    if (pointer[1] < 0) {
      await nextPage();
    } else if (addDivider) {
      const y = pointer[1] + rowSpace / 2;
      const divider = new CadLine({start: [0, y], end: [size[0], y]});
      divider.setColor("gray");
      await viewer.add(divider);
    }
    pointer[0] = 0;
    pointer[1] -= maxTextHeight + rowSpace;
  };
  await addRow(false);
  for (const rowData of bomTable.data) {
    await addRow(true, rowData);
  }

  await nextPage(true);
  return imgs;
};

export const printCads = async (params: PrintCadsParams) => {
  const cads = params.cads.map((v) => v.clone());
  const config = params.config || {};
  const extra = params.extra || {};
  const {width, height, scaleX, scaleY, scale} = getPrintInfo(210, 297);
  const errors: string[] = [];

  const pdfPadding: number[] = [];
  const 算料单页边距 = params.projectConfig.get("算料单页边距");
  const defaultPadding = 18;
  const 算料单页边距Num = Number(算料单页边距);
  if (isNaN(算料单页边距Num)) {
    const 算料单页边距Arr = 算料单页边距.split("+");
    for (const char of "上右下左") {
      const str = 算料单页边距Arr.find((v) => v.startsWith(char))?.slice(char.length);
      const num = Number(str);
      if (isNaN(num)) {
        pdfPadding.push(defaultPadding);
      } else {
        pdfPadding.push(num);
      }
    }
  } else {
    pdfPadding.push(算料单页边距 ? 算料单页边距Num : defaultPadding);
  }
  const config2: Partial<CadViewerConfig> = {
    backgroundColor: "white",
    padding: pdfPadding.map((v) => v * scale),
    hideLineLength: true,
    hideLineGongshi: true,
    minLinewidth: 0,
    ...config
  };
  const cad = new CadViewer(new CadData(), config2);
  cad.appendTo(document.body);
  cad.dom.style.opacity = "0";
  await prepareCadViewer(cad);

  const content: PdfDocument["content"] = [];
  const content2: PdfDocument["content"] = [];
  let pageOrientation: PdfDocument["pageOrientation"] = "portrait";
  for (let i = 0; i < cads.length; i++) {
    const data = cads[i];
    const rect = data.getBoundingRect();
    let localWidth: number;
    let localHeight: number;
    if (rect.width < rect.height) {
      localWidth = width;
      localHeight = height;
      if (i === 0) {
        pageOrientation = "portrait";
      }
    } else {
      localWidth = height;
      localHeight = width;
      if (i === 0) {
        pageOrientation = "landscape";
      }
    }
    cad.resize(localWidth * scaleX, localHeight * scaleY);
    await configCadDataForPrint(cad, data, params);
    data.updatePartners().updateComponents();
    await cad.reset(data).render();
    cad.center();
    const {拉手信息宽度} = extra;
    if (typeof 拉手信息宽度 === "number" && 拉手信息宽度 > 0) {
      const 拉手信息 = data.entities.mtext.filter((v) => v.text.startsWith("拉手:")).sort((v) => v.insert.x - v.insert.y);
      for (const mtext of 拉手信息) {
        const {el, text} = mtext;
        if (el && Number(el.width()) >= 拉手信息宽度) {
          try {
            mtext.text = getWrapedText(cad, text, mtext, getWrapedTextOptions(text, 拉手信息宽度)).join("\n     ");
            cad.render(mtext);
          } catch (error) {
            console.warn("拉手信息自动换行出错");
            console.warn(error);
          }
        }
      }
    }

    const designPics = params.designPics;
    let img: string | undefined;
    let img2: string | undefined;
    if (designPics) {
      for (const keyword in designPics) {
        const {urls, showSmall, showLarge, styles} = designPics[keyword];
        let isOwn = true;
        let currUrls = urls[i];
        if (!Array.isArray(currUrls) || currUrls.length === 0) {
          currUrls = urls[0];
          isOwn = false;
        }
        const result = findRectLines(data, keyword, showSmall);
        if (result.locator) {
          result.locator.visible = false;
          cad.render(result.locator);
        }
        if (Array.isArray(currUrls) && currUrls.length > 0) {
          for (const e of Object.values(result.lines)) {
            if (e) {
              e.visible = true;
              cad.render(e);
            }
          }
          if (result.errors.length < 1 && showSmall) {
            const cadImages = await drawDesignPics(data, keyword, currUrls.length, true, result.rect, styles);
            if (cadImages) {
              await setImagesUrl(cadImages, currUrls);
              await cad.render(cadImages);
              cad.center();
              img = await cad.toDataURL();
            }
          } else {
            img = await cad.toDataURL();
          }
          if (showLarge && isOwn) {
            const data2 = new CadData();
            const cadImages = await drawDesignPics(data2, keyword, currUrls.length, false, rect, styles);
            const cadImagePadding = [50 * scaleY, 50 * scaleX];
            if (cadImages) {
              await setImagesUrl(cadImages, currUrls);
              data2.entities.image = cadImages;
              const cadImage = cadImages[0];
              if (cadImage && keyword === "设计图") {
                const {x: px, y: py} = cadImage.position;
                const {x: ax, y: ay} = cadImage.anchor;
                const {x: sw, y: sh} = cadImage.sourceSize || new Point();
                const {x: tw, y: th} = cadImage.targetSize || new Point();
                const imgScale = Math.min(tw / sw, th / sh);
                const w = sw * imgScale;
                const h = sh * imgScale;
                const cadImageRect = new Rectangle([px - ax * w, py - ay * h], [px + (1 - ax) * w, py + (1 - ay) * h]);
                const imgScale2 = Math.min((localWidth * scaleX) / w, (localHeight * scaleY) / h);
                cadImageRect.transform({scale: imgScale2, origin: cadImageRect.getPoint(0.5, 0.5)});
                const insert = cadImageRect.getPoint(0.5, 1);
                insert.y += (localHeight * scaleY - cadImageRect.height) / 2 - cadImagePadding[0];
                let code: string;
                if (params.projectConfig.getBoolean("算料单效果图显示生产单号")) {
                  code = String(params.orders?.[i]?.materialResult?.生产单号 ?? "");
                } else {
                  code = params.codes?.[i] || "";
                }
                const mtext = new CadMtext({text: code, insert, anchor: [0.5, 0]});
                mtext.fontStyle.size = 100;
                mtext.fontStyle.color = "black";
                mtext.calcBoundingRect = false;
                data2.entities.add(mtext);
              }
              img2 = await getCadPreview("cad", data2, {
                config: {width: localWidth * scaleX, height: localHeight * scaleY, padding: cadImagePadding}
              });
            }
          }
        } else if (result.errors.length < 1 && result.rect.width > 0 && result.rect.height > 0) {
          const ids: string[] = [];
          for (const e of Object.values(result.lines)) {
            if (e) {
              ids.push(e.id);
            }
          }
          for (const e of data.entities.dimension) {
            if (e instanceof CadDimensionLinear) {
              if (intersection([e.entity1.id, e.entity2.id], ids).length > 0) {
                e.visible = false;
                cad.render(e);
              }
            }
          }
        }
      }
    }
    await draw型材物料明细(cad, data, params.orders?.[i]?.型材物料明细);
    img = await cad.toDataURL();
    content.push({image: img, width: localWidth, height: localHeight});
    if (img2) {
      content2.push({image: img2, width: localWidth, height: localHeight});
    }

    const cadConfig = cad.getConfig();
    const unfold = params.orders?.[i]?.unfold;
    if (unfold) {
      const unfoldImgs = await getUnfoldCadViewers(params, cadConfig, [localWidth, localHeight], i, unfold);
      for (const unfoldImg of unfoldImgs) {
        content2.push({image: unfoldImg, width: localWidth, height: localHeight});
      }
    }

    const bomTable = params.orders?.[i]?.bomTable;
    if (bomTable) {
      const imgs = await getBomTableImgs(bomTable, cadConfig, [localWidth, localHeight]);
      for (const image of imgs) {
        content2.push({image, width: localWidth, height: localHeight});
      }
    }
  }

  if (!params.keepCad) {
    cad.destroy();
  } else {
    setTimeout(() => {
      cad.dom.style.opacity = "";
    }, 0);
  }

  const pdf = createPdf(
    {
      info: {
        ...getPdfInfo(),
        title: "打印CAD",
        keywords: "cad print",
        ...params.info
      },
      content: content.concat(content2),
      pageSize: "A4",
      pageOrientation,
      pageMargins: 0
    },
    {}
  );
  const {pdfFile, url} = await new Promise<{pdfFile: File; url: string}>((resolve) => {
    pdf.getBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const name = params.codes?.join(",") || "print";
      const file = new File([blob], `${name}.pdf`, {type: "application/pdf"});
      resolve({pdfFile: file, url});
    });
  });
  return {url, errors, cad, pdfFile};
};

const draw型材物料明细 = async (cad: CadViewer, data: CadData, 型材物料明细: 型材物料明细 | undefined) => {
  if (!型材物料明细 || !型材物料明细.items) {
    return;
  }
  const lines = findRectLines(data, "型材物料明细", true);
  if (lines.errors.length > 0 || !lines.locator || !lines.rect.isFinite) {
    console.warn("型材物料明细定位出错");
    return;
  }

  const items0 = 型材物料明细.items;
  const items1: typeof items0 = [];
  const itemsGroup: (typeof items0)[] = [];
  for (const item of items0) {
    const keys: (keyof 型材物料明细Item)[] = ["铝型材", "型材颜色", "型材长度", "是横料", "左切角", "右切角"];
    const itemPrev = items1.find((v) => keys.every((k) => v[k] === item[k]));
    if (itemPrev) {
      itemPrev.要求数量 += item.要求数量;
    } else {
      items1.push(cloneDeep(item));
    }
  }
  for (const item of items1) {
    const keys: (keyof 型材物料明细Item)[] = ["铝型材", "型材颜色"];
    const itemsPrev = itemsGroup.find((v) => {
      if (!v.find((v2) => keys.every((k) => v2[k] === item[k]))) {
        return false;
      }
      const target = v.find((v2) => v2.是横料 === item.是横料);
      return !target || target.型材长度 === item.型材长度;
    });
    if (itemsPrev) {
      itemsPrev.push(item);
    } else {
      itemsGroup.push([item]);
    }
  }
  itemsGroup.sort((a, b) => a[0].铝型材.localeCompare(b[0].铝型材));

  const lineHeight = 119;
  const rowWidth = lines.rect.width;
  const widths = [180, 120, 80, 140, 80];
  widths.push(rowWidth - widths.reduce((a, b) => a + b, 0));
  const cellPadding = 10;
  let x = lines.rect.left;
  let y = lines.rect.top;
  const ps: Promise<void>[] = [];
  const addLine = (x1: number, y1: number, x2: number, y2: number) => {
    const line = new CadLine({start: [x1, y1], end: [x2, y2]});
    line.linewidth = 1;
    data.entities.add(line);
    ps.push(cad.render(line));
    return line;
  };
  const addText = (maxLength: number, text: string, insert: [number, number], anchor: [number, number], fontStyle?: FontStyle) => {
    const mtext = new CadMtext({text, insert, anchor, fontStyle});
    mtext.text = getWrapedText(cad, text, mtext, {maxLength}).join("\n");
    data.entities.add(mtext);
    ps.push(cad.render(mtext));
    return mtext;
  };
  const getWidth = (i: number) => widths.slice(0, i === -1 ? undefined : i + 1).reduce((a, b) => a + b, 0);
  for (const w of widths) {
    x += w;
    addLine(x, y, x, y - lineHeight * itemsGroup.length);
  }
  x = lines.rect.left;
  for (const items of itemsGroup) {
    addLine(x, y - lineHeight, x + rowWidth, y - lineHeight);
    addLine(x + getWidth(1), y - lineHeight / 2, x + getWidth(-2), y - lineHeight / 2);

    const img = new CadImage();
    img.position.set(x + cellPadding, y - cellPadding);
    img.anchor.set(0, 0);
    img.targetSize = new Point(widths[0] - cellPadding * 2, lineHeight - cellPadding * 2);
    await setImageUrl(img, items[0].截面图);
    data.entities.add(img);
    ps.push(cad.render(img));
    x += widths[0];

    addText(widths[1], items[0].铝型材, [x + widths[1] / 2, y - lineHeight / 2], [0.5, 0.5], {size: 40});
    x += widths[1];

    addText(widths[2], "横料", [x + widths[2] / 2, y - lineHeight * 0.25], [0.5, 0.5], {size: 30});
    addText(widths[2], "竖料", [x + widths[2] / 2, y - lineHeight * 0.75], [0.5, 0.5], {size: 30});
    x += widths[2];

    const get切角Str = (items2: typeof items) => {
      const 双45Count = items2.filter((v) => v.左切角 === "45" && v.右切角 === "45").length;
      if (双45Count > 0) {
        return "双45";
      }
      const 单45Count = items2.filter((v) => v.左切角 === "45" || v.右切角 === "45").length - 双45Count;
      if (单45Count > 0) {
        return "单45";
      }
      const 双90Count = items2.filter((v) => v.左切角 === "90" && v.右切角 === "90").length;
      if (双90Count > 0) {
        return "双90";
      }
      return "";
    };

    const 横料 = items.filter((v) => v.是横料 === "是");
    const 横料Count = 横料.reduce((a, b) => a + b.要求数量, 0);
    if (横料Count > 0) {
      const text = `${横料[0].型材长度}=${横料Count}`;
      addText(widths[3], text, [x + widths[3] / 2, y - lineHeight * 0.25], [0.5, 0.5], {size: 30});
    }
    const 竖料 = items.filter((v) => v.是横料 === "否");
    const 竖料Count = 竖料.reduce((a, b) => a + b.要求数量, 0);
    if (竖料Count > 0) {
      const text = `${竖料[0].型材长度}=${竖料Count}`;
      addText(widths[3], text, [x + widths[3] / 2, y - lineHeight * 0.75], [0.5, 0.5], {size: 30});
    }
    x += widths[3];

    const 横料切角Str = get切角Str(横料);
    if (横料切角Str) {
      addText(widths[4], 横料切角Str, [x + widths[4] / 2, y - lineHeight * 0.25], [0.5, 0.5], {size: 30});
    }
    const 竖料切角Str = get切角Str(竖料);
    if (竖料切角Str) {
      addText(widths[4], 竖料切角Str, [x + widths[4] / 2, y - lineHeight * 0.75], [0.5, 0.5], {size: 30});
    }
    x += widths[4];

    addText(widths[5], items[0].型材颜色, [x + widths[5] / 2, y - lineHeight / 2], [0.5, 0.5], {size: 30});

    x = lines.rect.left;
    y -= lineHeight;
  }
  await Promise.all(ps);
  lines.locator.visible = false;
  await cad.render(lines.locator);
};
