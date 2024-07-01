import {remoteHost} from "@app/app.common";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {Formulas} from "@app/utils/calc";
import {ProjectConfig} from "@app/utils/project-config";
import {getCalcZhankaiText} from "@app/utils/zhankai";
import {environment} from "@env";
import {
  CadArc,
  CadCircle,
  CadData,
  CadDimension,
  CadDimensionLinear,
  CadLeader,
  CadLine,
  CadLineLike,
  CadMtext,
  CadMtextInfo,
  CadViewer,
  findAllAdjacentLines,
  generateLineTexts,
  generatePointsMap,
  getLinesDistance,
  intersectionKeys,
  intersectionKeysTranslate,
  sortLines
} from "@lucilor/cad-viewer";
import {DEFAULT_TOLERANCE, isBetween, isEqualTo, isGreaterThan, isTypeOf, Line, ObjectOf, Point} from "@lucilor/utils";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {difference, isEmpty} from "lodash";
import {CadCollection} from "./collections";
import {cadDimensionOptions} from "./options";

export const reservedDimNames = ["前板宽", "后板宽", "小前板宽", "小后板宽", "骨架宽", "小骨架宽", "骨架中空宽", "小骨架中空宽"];

export const maxLineLength = 130 as const;

export const 激光开料标记线类型 = ["短直线", "直角三角形", "等腰三角形"] as const;

const cadSkipTypes = [
  "铰企料",
  "中锁料",
  "中铰料",
  "小锁料",
  "扇锁企料",
  "中铰料",
  "中锁料",
  "铰企料",
  "包边正面",
  "锁框",
  "铰框",
  "顶框",
  "底框",
  "中横框",
  "算料单示意图",
  "______算料单示意图"
];

export const prepareCadViewer = async (cad: CadViewer) => {
  let url = "n/static/fonts/xhzj_sp.ttf";
  if (environment.production) {
    url = `${remoteHost}/${url}`;
  }
  await cad.loadFont({name: "喜鸿至简特殊字体", url});
};

export interface ValidateResult {
  errors: string[];
  errorLines: CadLineLike[][];
}

export const getCadTypes = (data: CadData) => [...data.type.split("*"), ...data.type2.split("*")].filter(Boolean);

export const isShiyitu = (data: CadData) => getCadTypes(data).some((type) => /示意图|截面图|铝型材|装配图/.test(type));

export const getCadMinLineLength = (data: CadData) => {
  const isShiyituCad = isShiyitu(data);
  const types = getCadTypes(data);
  if (isShiyituCad) {
    if (types.includes("铝型材")) {
      return 0.5;
    } else if (types.some((type) => type.match(/胶条示意图/))) {
      return 0.5;
    } else if (types.some((type) => type.match(/铝板示意图/))) {
      return 0;
    } else {
      return 3;
    }
  }
  return 0;
};

export const filterCadEntitiesToSave = (data: CadData) => {
  const dimRefLines: string[] = [];
  for (const e of data.entities.dimension) {
    if (e instanceof CadDimensionLinear) {
      if (e.entity1.id) {
        dimRefLines.push(e.entity1.id);
      }
      if (e.entity2.id) {
        dimRefLines.push(e.entity2.id);
      }
    }
  }
  const minLineLength = getCadMinLineLength(data);
  let entities = data.entities;
  const count = entities.line.length + entities.arc.length;
  if (count >= 200) {
    entities = entities.filter((e) => {
      if (e instanceof CadLine || e instanceof CadArc) {
        if (minLineLength <= 0 || dimRefLines.includes(e.id)) {
          return true;
        }
        const length = e.length;
        for (const n of [1, 2, 3]) {
          if (isEqualTo(length, n)) {
            return true;
          }
        }
        return isGreaterThan(length, minLineLength);
      }
      return true;
    });
  }
  return {dimRefLines, minLineLength, entities};
};

export const LINE_LIMIT = [0.01, 0.1] as const;
export const validColors = ["#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff"] as const;
export const validateLines = (data: CadData, noInfo?: boolean, tol = DEFAULT_TOLERANCE) => {
  const result: ValidateResult = {errors: [], errorLines: []};
  data.entities.forEach((e) => {
    if (e instanceof CadLineLike) {
      delete e.info.errors;
    }
  });
  if (isShiyitu(data) || ["企料算料", "孔"].includes(data.type)) {
    return result;
  }
  const typeCheck = cadSkipTypes.includes(data.type);
  const lines = sortLines(data, tol);
  result.errorLines = lines;
  const [min, max] = LINE_LIMIT;
  const groupMaxLength = data.shuangxiangzhewan ? 2 : 1;
  const addInfoError = (e: CadLineLike, error: string) => {
    if (noInfo) {
      return;
    }
    if (!e.info.errors) {
      e.info.errors = [];
    }
    if (!e.info.errors.includes(error)) {
      e.info.errors.push(error);
    }
  };
  const slopeErrMax = 5;
  let slopeErrCount = 0;
  for (const v of lines) {
    let 刨坑起始线数量 = 0;
    let 刨坑起始线位置错误 = false;
    for (const [i, e] of v.entries()) {
      const {start, end} = e;
      e.info.errors = [];
      const dx = Math.abs(start.x - end.x);
      const dy = Math.abs(start.y - end.y);
      if (e.刨坑起始线) {
        刨坑起始线数量++;
        if (i !== 0 && i !== v.length - 1) {
          刨坑起始线位置错误 = true;
        }
      }
      if (typeCheck && (isBetween(dx, min, max) || isBetween(dy, min, max))) {
        addInfoError(e, "斜率不符合要求");
        slopeErrCount++;
        if (slopeErrCount <= slopeErrMax) {
          result.errors.push(`线段斜率不符合要求(线长: ${e.length.toFixed(2)})`);
        }
      }
    }
    if (刨坑起始线数量 > 1) {
      result.errors.push("不能有多根刨坑起始线");
    }
    if (刨坑起始线位置错误) {
      result.errors.push("刨坑起始线必须是第一根或最后一根");
    }
  }
  if (lines.length < 1) {
    result.errors.push("没有线");
  } else if (typeCheck && lines.length > groupMaxLength) {
    result.errors.push("CAD分成了多段或线重叠");
    for (let i = 0; i < lines.length - 1; i++) {
      const currGroup = lines[i];
      const nextGroup = lines[i + 1];
      const l1 = currGroup[0];
      const l2 = currGroup[currGroup.length - 1];
      const l3 = nextGroup[0];
      const l4 = nextGroup[nextGroup.length - 1];
      let minD = Infinity;
      let errLines: CadLineLike[] = [];
      [
        [l1, l3],
        [l1, l4],
        [l2, l3],
        [l2, l4]
      ].forEach((group) => {
        const d = getLinesDistance(group[0], group[1]);
        if (d < minD) {
          minD = d;
          errLines = group;
        }
      });
      errLines.forEach((l) => {
        addInfoError(l, "CAD分成了多段的断裂处");
      });
    }
  }
  return result;
};

export const validateCad = (data: CadData, noInfo?: boolean, tol = DEFAULT_TOLERANCE) => {
  const result: ValidateResult = {errors: [], errorLines: []};
  const entities = data.getAllEntities();
  const idsAll = entities.toArray().map((e) => e.id);
  for (const key of intersectionKeys) {
    const idsToFind: string[] = data[key].flat();
    if (difference(idsToFind, idsAll).length > 0) {
      result.errors.push(`${intersectionKeysTranslate[key]}存在无效数据`);
    }
  }
  if (!isEmpty(data.blocks) || data.entities.insert.length > 0) {
    result.errors.push("不能包含块");
  }
  const linesResult = validateLines(data, noInfo, tol);
  for (const key in result) {
    (result as any)[key].push(...(linesResult as any)[key]);
  }
  return result;
};

export const autoFixLine = (cad: CadViewer, line: CadLine, tol = DEFAULT_TOLERANCE) => {
  const {start, end} = line;
  const dx = start.x - end.x;
  const dy = start.y - end.y;
  const [min, max] = LINE_LIMIT;
  const translate = new Point();
  if (isBetween(Math.abs(dx), min, max)) {
    translate.x = dx;
  }
  if (isBetween(Math.abs(dy), min, max)) {
    translate.y = dy;
  }
  const map = generatePointsMap(cad.data.getAllEntities(), tol);
  const {entities} = findAllAdjacentLines(map, line, line.end, tol);
  entities.forEach((e) => e.transform({translate}, true));
  line.end.add(translate);
};

export const suanliaodanZoomIn = (data: CadData) => {
  if (!data.info.skipSuanliaodanZoom) {
    for (const v of data.components.data) {
      v.entities.forEach((e) => {
        e.calcBoundingRect = e.calcBoundingRect && e instanceof CadLineLike;
      });
      const lastSuanliaodanZoom = v.info.lastSuanliaodanZoom ?? 1;
      const rect = v.getBoundingRect();
      if (!rect.isFinite) {
        continue;
      }
      if (lastSuanliaodanZoom !== v.suanliaodanZoom) {
        v.info.lastSuanliaodanZoom = v.suanliaodanZoom;
        v.transform({scale: v.suanliaodanZoom / lastSuanliaodanZoom, origin: [rect.left, rect.top]}, true);
      }
    }
  }
  data.updateComponents();
};

export const suanliaodanZoomOut = (data: CadData) => {
  if (!data.info.skipSuanliaodanZoom) {
    for (const v of data.components.data) {
      v.entities.forEach((e) => {
        e.calcBoundingRect = e.calcBoundingRect && e instanceof CadLineLike;
      });
      const lastSuanliaodanZoom = v.info.lastSuanliaodanZoom ?? 1;
      const rect = v.getBoundingRect();
      if (!rect.isFinite) {
        continue;
      }
      if (lastSuanliaodanZoom !== 1) {
        delete v.info.lastSuanliaodanZoom;
        v.transform({scale: 1 / lastSuanliaodanZoom, origin: [rect.left, rect.top]}, true);
      }
    }
  }
  data.updateComponents();
  ``;
};

export const getCadTotalLength = (data: CadData) => {
  let length = 0;
  const entities = data.getAllEntities();
  entities.line.forEach((e) => (length += e.info.线长 || e.length));
  entities.arc.forEach((e) => (length += e.length));
  entities.circle.forEach((e) => (length += e.curve.length));
  return length;
};

export const splitShuangxiangCad = (data: CadData) => {
  if (!data.shuangxiangzhewan) {
    return null;
  }
  const lines = sortLines(data);
  const result = lines
    .map((v) => {
      const d = new CadData();
      d.entities.add(...v);
      return d;
    })
    .sort((a, b) => {
      const {width: w1, height: h1} = a.getBoundingRect();
      const {width: w2, height: h2} = b.getBoundingRect();
      return h1 / w1 - h2 / w2;
    });
  if (result.length !== 2) {
    return null;
  }
  return result as [CadData, CadData];
};

export const getShuangxiangLineRects = (data: ReturnType<typeof splitShuangxiangCad>) => {
  if (!data) {
    return null;
  }
  const [a, b] = data;
  return [a.getBoundingRect(), b.getBoundingRect()];
};

export const setShuangxiangLineRects = (
  data: ReturnType<typeof splitShuangxiangCad>,
  rects: ReturnType<typeof getShuangxiangLineRects>
) => {
  if (!data || !rects) {
    return;
  }
  const rects2 = data.map((v) => v.getBoundingRect());
  for (let i = 0; i < rects.length; i++) {
    const rect1 = rects[i];
    const rect2 = rects2[i];
    const dx = rect1.x - rect2.x;
    const dy = rect1.y - rect2.y;
    data[i].transform({translate: [dx, dy]}, true);
  }
};

export const shouldShowIntersection = (data: CadData) => {
  for (const key of intersectionKeys) {
    if (data[key].filter((v) => v.length > 0).length > 0) {
      return true;
    }
  }
  return false;
};

export const showIntersections = (data: CadData, projectConfig: ProjectConfig) => {
  if (!shouldShowIntersection(data)) {
    return;
  }
  const sortedEntitiesGroups = sortLines(data);
  const rect = data.getBoundingRect();
  const rectCenter = new Point(rect.x, rect.y);
  const drawing = {
    leader: {length: 32, gap: 4, size: 15},
    circle: {radius: 8, linetype: "DASHEDX2", linewidth: 2},
    text: {size: 24, text: "", offset: 0}
  };
  for (const key of intersectionKeys) {
    const arr = data[key];
    for (const sortedEntities of sortedEntitiesGroups) {
      for (let i = 0; i < sortedEntities.length; i++) {
        const e1 = sortedEntities[i];
        const e2 = sortedEntities.at(i + 1);
        let matched = false;
        let isStartPoint = false;
        let isEndPoint = false;
        for (const ids of arr) {
          if (ids.length === 1 && e1.isId(ids[0])) {
            if (i === 0) {
              matched = true;
              isStartPoint = true;
            } else if (i === sortedEntities.length - 1) {
              matched = true;
              isEndPoint = true;
            }
            break;
          }
          if (e1.isId(ids) && e2?.isId(ids)) {
            matched = true;
            break;
          }
        }
        if (!matched) {
          continue;
        }
        let p1: Point;
        let p2: Point;
        let p3: Point;
        if (isStartPoint) {
          p1 = rectCenter;
          p2 = e1.start;
          p3 = e1.end;
        } else if (isEndPoint) {
          p1 = e1.start;
          p2 = e1.end;
          p3 = rectCenter;
        } else {
          if (!e2) {
            continue;
          }
          p1 = e1.start;
          p2 = e1.end;
          p3 = e2.end;
        }
        const p4 = p1.clone().sub(p2).normalize().add(p3.clone().sub(p2).normalize());
        const p5 = p2.clone().add(p4);
        const p6 = p2.clone().sub(p4);
        const center = new Line(p1, p3).middle;
        let line: Line;
        if (p5.distanceTo(center) > p6.distanceTo(center)) {
          line = new Line(p5.clone(), p2.clone());
        } else {
          line = new Line(p6.clone(), p2.clone());
        }
        const theta = line.theta.rad;
        const d = new Point(Math.cos(theta), Math.sin(theta));
        let drawLeader = false;
        let drawCircle = false;
        let drawText = false;
        let layer = "";
        if (key === "zhidingweizhipaokeng") {
          line.end.sub(d.clone().multiply(drawing.leader.gap));
          line.start.copy(line.end.clone().sub(d.clone().multiply(drawing.leader.length)));
          const 指定位置刨坑表示方法 = projectConfig.get("指定位置刨坑表示方法", "箭头");
          if (指定位置刨坑表示方法 === "箭头") {
            drawLeader = true;
          } else if (指定位置刨坑表示方法 === "箭头+箭头旁文字") {
            drawLeader = true;
            drawText = true;
          } else if (指定位置刨坑表示方法 === "虚线圆") {
            drawCircle = true;
          } else if (指定位置刨坑表示方法 === "虚线圆+旁边文字") {
            drawCircle = true;
            drawText = true;
          }
          layer = "指定位置刨坑";
          drawing.text.text = "刨";
          drawing.text.offset = 8;
        } else if (key === "指定位置不折") {
          line.end.sub(d.clone().multiply(drawing.leader.gap));
          line.start.copy(line.end.clone().sub(d.clone().multiply(drawing.leader.length)));
          const 指定位置不折表示方法 = projectConfig.get("指定位置不折表示方法", "箭头");
          if (指定位置不折表示方法 === "箭头") {
            drawLeader = true;
          } else if (指定位置不折表示方法 === "箭头+箭头旁文字") {
            drawLeader = true;
            drawText = true;
          } else if (指定位置不折表示方法 === "虚线圆") {
            drawCircle = true;
          } else if (指定位置不折表示方法 === "虚线圆+旁边文字") {
            drawCircle = true;
            drawText = true;
          }
          layer = "指定位置不折";
          drawing.text.text = "不折";
          drawing.text.offset = 8;
        } else if (key === "指定分体位置") {
          layer = "分体";
          drawCircle = true;
          drawText = true;
          drawing.text.text = "分";
          drawing.text.offset = 3;
        }
        if (drawLeader) {
          const leader = new CadLeader({
            layer,
            vertices: [line.end, line.start],
            size: drawing.leader.size,
            info: {isIntersectionEntity: true}
          });
          data.entities.add(leader);
        }
        if (drawCircle) {
          const radius = Math.min(drawing.circle.radius, p1.distanceTo(p2) / 2 - 1, p2.distanceTo(p3) / 2 - 1);
          const circle = new CadCircle({
            layer,
            center: p2,
            radius,
            linetype: drawing.circle.linetype,
            linewidth: drawing.circle.linewidth,
            color: 5,
            info: {isIntersectionEntity: true}
          });
          data.entities.add(circle);
        }
        if (drawText) {
          let anchor = [0, 0];
          let insert = [0, 0];
          if (drawLeader) {
            anchor = [d.x > 0 ? 1 : 0, d.y < 0 ? 1 : 0];
            insert = line.start.clone().sub(d.clone().multiply(drawing.text.offset)).toArray();
          } else if (drawCircle) {
            anchor = [d.x > 0 ? 1 : 0, d.y < 0 ? 1 : 0];
            insert = p2.clone().sub(d.clone().multiply(drawing.text.offset)).toArray();
          }
          const text = new CadMtext({
            layer,
            insert,
            text: drawing.text.text,
            anchor,
            font_size: drawing.text.size,
            info: {isIntersectionEntity: true}
          });
          data.entities.add(text);
        }
      }
    }
  }
};

export const removeIntersections = (data: CadData) => {
  data.entities = data.entities.filter((entity) => !entity.info?.isIntersectionEntity);
};

export const setDimensionText = (e: CadDimension, materialResult: Formulas) => {
  if (!(typeof e.mingzi === "string")) {
    e.mingzi = String(e.mingzi);
  }
  const match = e.mingzi.match(/显示公式[ ]*[:：](.*)/);
  let 显示公式: string | null = null;
  if (match && match.length > 1) {
    显示公式 = match[1].trim();
  }
  let 活动标注 = false;
  if (显示公式 !== null) {
    if (isNaN(Number(显示公式)) && 显示公式 in materialResult) {
      显示公式 = String(materialResult[显示公式]);
    }
    e.mingzi = 显示公式;
  } else if (e.mingzi.includes("活动标注")) {
    活动标注 = true;
    e.mingzi = "<>";
  }
  return {显示公式, 活动标注};
};

export const getCadCalcZhankaiText = (
  cad: CadData,
  calcZhankai: any[],
  materialResult: ObjectOf<any>,
  bancai: {mingzi?: string; cailiao?: string; houdu?: string; zidingyi?: string},
  项目配置: ObjectOf<string>,
  项目名: string
) => {
  const CAD来源 = "算料";
  let 板材 = bancai.mingzi || "";
  if (bancai && 板材 === "自定义") {
    板材 = bancai.zidingyi || "";
  }
  const 板材厚度 = bancai.houdu || "";
  const 材料 = bancai.cailiao || "";
  const CAD属性 = {
    name: cad.name,
    suanliaodanxianshibancai: cad.suanliaodanxianshibancai,
    shuangxiangzhewan: cad.shuangxiangzhewan,
    算料单展开显示位置: cad.算料单展开显示位置,
    算料特殊要求: cad.算料特殊要求,
    suanliaodanxianshi: cad.suanliaodanxianshi,
    suanliaochuli: cad.suanliaochuli,
    kailiaoshibaokeng: cad.kailiaoshibaokeng,
    zhidingweizhipaokeng: cad.zhidingweizhipaokeng,
    gudingkailiaobancai: cad.gudingkailiaobancai,
    houtaiFenlei: cad.type,
    bancaiwenlifangxiang: cad.bancaiwenlifangxiang,
    zhankai: cad.zhankai,
    overrideShuliang: undefined,
    xianshimingzi: cad.xianshimingzi,
    attributes: cad.attributes
  };

  const text = getCalcZhankaiText(CAD来源, calcZhankai, materialResult, 板材, 板材厚度, 材料, 项目配置, 项目名, CAD属性);
  return text;
};

export const exportCadDataRemoveLengthTextCount = 200 as const;
export const exportCadData = (data: CadData) => {
  const exportData = data.export();
  const count = data.entities.line.length + data.entities.arc.length;
  for (const type of ["line", "arc"]) {
    const entities = exportData.entities?.[type];
    if (!isTypeOf(entities, "object")) {
      continue;
    }
    for (const id in entities) {
      const e = entities[id];
      const mtexts = e.children?.mtext;
      if (mtexts) {
        for (const mtextId of Object.keys(mtexts)) {
          const mtext = mtexts[mtextId];
          const {isLengthText, isGongshiText, isBianhuazhiText} = (mtext.info || {}) as CadMtextInfo;
          if (isGongshiText || isBianhuazhiText) {
            delete mtexts[mtextId];
          } else if (isLengthText) {
            if (count > exportCadDataRemoveLengthTextCount) {
              delete mtexts[mtextId];
            } else {
              const keys = ["type", "info", "insert", "lineweight", "anchor"];
              for (const key of Object.keys(mtext)) {
                if (!keys.includes(key)) {
                  delete mtext[key];
                }
              }
            }
          }
        }
      }
    }
  }
  return exportData;
};

export const openCadDimensionForm = async (
  collection: CadCollection,
  message: MessageService,
  cad: CadViewer,
  dimension: CadDimensionLinear
) => {
  const dimension2 = dimension.clone();
  const form: InputInfo<typeof dimension>[] = [
    {type: "string", label: "名字", model: {data: dimension2, key: "mingzi"}},
    {type: "boolean", label: "删除标注", appearance: "radio", value: false},
    {type: "boolean", label: "隐藏尺寸线", appearance: "radio", value: !!dimension2.style.dimensionLine?.hidden},
    {
      type: "select",
      label: "小数处理",
      model: {data: dimension2, key: "xiaoshuchuli"},
      options: cadDimensionOptions.xiaoshuchuli.values.slice()
    },
    {type: "number", label: "字体大小", value: dimension2.style.text?.size}
  ];
  const name = dimension2.mingzi;
  let title = "编辑标注";
  if (name) {
    title += `【${name}】`;
  }
  const result = await message.form(form, {title});
  if (result) {
    if (result.删除标注) {
      cad.remove(dimension);
    } else {
      Object.assign(dimension, dimension2);
      if (result.隐藏尺寸线) {
        dimension.setStyle({dimensionLine: {hidden: true}});
      }
      if (result.字体大小) {
        dimension.setStyle({text: {size: result.字体大小}});
      }
      await cad.render(dimension);
    }
  }
  return result;
};

export const getLineLengthTextSize = (line: CadLineLike) => {
  let size: number;
  const length = line.length;
  if (length > 54) {
    size = 35;
  } else if (length > 30) {
    size = 30;
  } else if (length > 20) {
    size = 24;
  } else {
    size = 18;
  }
  return size;
};

export const isLengthTextSizeSetKey = "isLengthTextSizeSet" as const;
export const generateLineTexts2 = (data: CadData) => {
  generateLineTexts(data);
  data.entities.forEach((e) => {
    if (e instanceof CadLineLike) {
      if (!e.info[isLengthTextSizeSetKey]) {
        e.lengthTextSize = getLineLengthTextSize(e);
      }
    }
  });
};

export const uploadAndReplaceCad = async (file: File, data: CadData, isMain: boolean, message: MessageService, http: CadDataService) => {
  const content = `确定要上传<span style="color:red">${file.name}</span>并替换<span style="color:red">${data.name}</span>的数据吗？`;
  const yes = await message.confirm(content);
  if (yes) {
    const resData = await http.uploadDxf(file);
    if (resData) {
      const lines = resData.entities.line;
      const groupedLines: CadLine[][] = [];
      const isLinesDepulicate = (e1: CadLine, e2: CadLine) => {
        if (e1.start.equals(e2.start) && e1.end.equals(e2.end)) {
          return true;
        } else if (e1.start.equals(e2.end) && e1.end.equals(e2.start)) {
          return true;
        }
        return false;
      };
      const toRemove: string[] = [];
      for (const e of lines) {
        if (groupedLines.length > 0) {
          const group = groupedLines.find((e2) => e2[0] && isLinesDepulicate(e, e2[0]));
          if (group) {
            group.push(e);
            toRemove.push(e.id);
          } else {
            groupedLines.push([e]);
          }
        } else {
          groupedLines.push([e]);
        }
      }
      if (toRemove.length > 0 && (await message.confirm("存在重复线，是否自动清理？"))) {
        resData.entities.line = resData.entities.line.filter((e) => !toRemove.includes(e.id));
      }
      const isShiyituCad = isShiyitu(data);
      const toRemoveDims: CadDimensionLinear[] = [];
      resData.entities.forEach((e) => {
        if (e instanceof CadDimensionLinear) {
          if (e.defPoints) {
            toRemoveDims.push(e);
          }
        }
        if (e instanceof CadLineLike) {
          if (isShiyituCad) {
            e.hideLength = true;
          }
        }
      });
      if (toRemoveDims.length > 0) {
        const namesStr = toRemoveDims.map((e) => e.mingzi).join("，");
        if (await message.confirm(`以下标注没有标到直线端点，是否自动清理？<br>${namesStr}`)) {
          resData.entities.dimension = resData.entities.dimension.filter((e) => toRemoveDims.find((v) => v.id !== e.id));
        }
      }

      if (isMain) {
        const data1 = new CadData();
        data1.entities = data.entities;
        const data2 = new CadData();
        data2.entities = resData.entities;
        const rect1 = data1.getBoundingRect();
        const rect2 = data2.getBoundingRect();
        if (rect1.isFinite && rect2.isFinite) {
          data2.transform({translate: rect1.min.clone().sub(rect2.min)}, true);
        }
        data.entities = data2.entities;
      } else {
        data.entities = resData.entities;
        // data.partners = resData.partners;
        // data.components = resData.components;
        data.zhidingweizhipaokeng = resData.zhidingweizhipaokeng;
        data.info = resData.info;
      }
      data.blocks = resData.blocks;
      data.layers = resData.layers;
      return true;
    }
  }
  return false;
};

export const autoShuangxiangzhewan = (data: CadData, tolerance?: number) => {
  if (cadSkipTypes.includes(data.type)) {
    return;
  }
  const lines = sortLines(data, tolerance);
  if (lines.length !== 2) {
    return;
  }
  const [lines1, lines2] = lines;
  let intersectionCount = 0;
  for (const line1 of lines1) {
    for (const line2 of lines2) {
      if (line1.curve.intersects(line2.curve).length > 0) {
        intersectionCount++;
      }
    }
  }
  if (intersectionCount === 1) {
    data.shuangxiangzhewan = true;
  }
};
