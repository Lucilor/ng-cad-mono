import {remoteHost} from "@app/app.common";
import {environment} from "@env";
import {CadData, CadDimension, CadImage, CadLineLike, CadMtext, CadViewer, CadViewerConfig} from "@lucilor/cad-viewer";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {CadCollection} from "./collections";
import {isShiyitu, prepareCadViewer} from "./utils";

export interface CadPreviewRawParams {
  fixedLengthTextSize?: number;
  fixedDimTextSize?: number;
  fixedMtextSize?: number;
  config?: Partial<CadViewerConfig>;
  autoSize?: boolean;
  maxZoom?: number;
}
export const getCadPreviewRaw = async (collection: CadCollection, data: CadData, params: CadPreviewRawParams = {}) => {
  const shiyitu = isShiyitu(data);
  const cad = new CadViewer(new CadData(), {
    width: 300,
    height: 150,
    padding: [5],
    backgroundColor: "rgba(0,0,0,0)",
    hideLineLength: collection === "CADmuban" || shiyitu,
    hideLineGongshi: true,
    ...params.config
  });
  cad.dom.style.opacity = "0";
  cad.appendTo(document.body);
  await prepareCadViewer(cad);
  cad.data = data.clone();
  if (shiyitu) {
    cad.data.entities.dimension = [];
  }
  if (collection !== "cad") {
    cad.data.entities.mtext = [];
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

export interface CadPreviewParams extends CadPreviewRawParams {
  http?: CadDataService;
  noCache?: boolean;
}
export const getCadPreview = async (collection: CadCollection, data: CadData, params: CadPreviewParams = {}) => {
  const {http, noCache} = params;
  let url: string | null;
  if (http) {
    url = await http.getCadImg(data.id, noCache, {silent: true});
    if (url) {
      if (!environment.production) {
        url = url.replace(remoteHost, origin);
      }
      return url;
    }
  }
  const cad = await getCadPreviewRaw(collection, data, params);
  url = await cad.toDataURL();
  if (http) {
    http.setCadImg(data.id, url, {silent: true});
  }
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
