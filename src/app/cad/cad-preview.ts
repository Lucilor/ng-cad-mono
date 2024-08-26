import {CadData, CadDimension, CadImage, CadLineLike, CadMtext, CadViewer, CadViewerConfig} from "@lucilor/cad-viewer";
import {CadCollection} from "./collections";
import {prepareCadViewer} from "./utils";

export interface CadPreviewRawParams {
  fixedLengthTextSize?: number;
  fixedDimTextSize?: number;
  fixedMtextSize?: number;
  config?: Partial<CadViewerConfig>;
  autoSize?: boolean;
  maxZoom?: number;
}
export const getCadPreviewRaw = async (collection: CadCollection, data: CadData, params: CadPreviewRawParams = {}) => {
  const cad = new CadViewer(new CadData(), {
    width: 300,
    height: 150,
    padding: [5],
    backgroundColor: "rgba(0,0,0,0)",
    hideLineLength: collection === "CADmuban",
    hideLineGongshi: false,
    lineGongshi: 8,
    ...params.config
  });
  cad.dom.style.opacity = "0";
  cad.dom.style.position = "fixed";
  cad.appendTo(document.body);
  await prepareCadViewer(cad);
  cad.data = data.clone();
  for (const e of cad.data.entities.dimension) {
    e.calcBoundingRect = true;
  }
  await cad.render();
  if (params.autoSize) {
    const {width, height} = cad.data.getBoundingRect();
    cad.resize(width, height);
  }
  cad.center();

  const {fixedLengthTextSize, fixedDimTextSize, fixedMtextSize} = params;
  if ([fixedLengthTextSize, fixedDimTextSize, fixedMtextSize].some((size) => size !== undefined)) {
    const resize = () => {
      const zoom = cad.zoom();
      const lengthTextSize = typeof fixedLengthTextSize === "number" ? fixedLengthTextSize / zoom : null;
      const dimTextSize = typeof fixedDimTextSize === "number" ? fixedDimTextSize / zoom : null;
      const mtextSize = typeof fixedMtextSize === "number" ? fixedMtextSize / zoom : null;
      cad.data.entities.forEach((e) => {
        if (e instanceof CadLineLike && lengthTextSize !== null) {
          e.lengthTextSize = lengthTextSize;
          e.children.mtext.forEach((mtext) => {
            mtext.info.offset = [0, 0];
          });
          cad.render(e);
        } else if (e instanceof CadDimension && dimTextSize !== null) {
          e.setStyle({text: {size: dimTextSize}});
          cad.render(e);
        } else if (e instanceof CadMtext && mtextSize !== null) {
          e.fontStyle.size = mtextSize;
          cad.render(e);
        }
      });
      cad.center();
    };
    resize();
    resize();
  }
  const maxZoom = params.maxZoom;
  if (typeof maxZoom === "number" && !isNaN(maxZoom) && cad.zoom() > maxZoom) {
    cad.zoom(maxZoom);
  }
  return cad;
};

export type CadPreviewParams = CadPreviewRawParams;
export const getCadPreview = async (collection: CadCollection, data: CadData, params: CadPreviewParams = {}) => {
  const cad = await getCadPreviewRaw(collection, data, params);
  const url = await cad.toDataURL();
  cad.destroy();
  return url;
};

export const updateCadPreviewImg = async (data: CadData, mode: "pre" | "post", disabled: boolean) => {
  let cadImage = data.entities.image.find((e) => e.info.isPreviewImg);
  if (disabled) {
    if (cadImage) {
      cadImage.remove();
    }
    return [];
  }
  if (!cadImage && mode === "pre") {
    return [];
  }

  const finish = () => {
    data.entities.forEach((e) => {
      e.visible = false;
      e.calcBoundingRectForce = e.calcBoundingRect;
    });
    if (cadImage) {
      cadImage.calcBoundingRect = false;
      cadImage.calcBoundingRectForce = false;
      cadImage.visible = true;
    }
  };
  if (cadImage) {
    finish();
    return [];
  }
  cadImage = new CadImage();
  cadImage.layer = "预览图";
  cadImage.info.isPreviewImg = true;
  cadImage.anchor.set(0.5, 0.5);
  const cad = await getCadPreviewRaw("cad", data, {autoSize: true, config: {padding: [0]}});
  cadImage.url = await cad.toDataURL();
  const {x, y} = cad.data.getBoundingRect();
  cad.destroy();
  cadImage.position.set(x, y);
  data.entities.add(cadImage);

  finish();
  return [cadImage];
};
