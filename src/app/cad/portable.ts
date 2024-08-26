import {getValueString, replaceChars} from "@app/app.common";
import {AppUser} from "@app/services/app-status.types";
import {ProjectConfig} from "@app/utils/project-config";
import {ImportCache} from "@app/views/import/import.types";
import {
  CadArc,
  CadCircle,
  CadData,
  CadDimension,
  CadDimensionLinear,
  CadEntities,
  CadLeader,
  CadLine,
  CadLineLike,
  CadMtext,
  CadVersion,
  CadZhankai,
  generatePointsMap,
  setLinesLength,
  sortLines
} from "@lucilor/cad-viewer";
import {keysOf, Line, ObjectOf, Point, Rectangle} from "@lucilor/utils";
import {cadFields} from "@modules/cad-editor/components/menu/cad-info/cad-info.utils";
import {difference, intersection, isEqual, uniqueId} from "lodash";
import {autoShuangxiangzhewan, generateLineTexts2, isShiyitu, showIntersections} from "./utils";

export interface Slgs {
  名字: string;
  分类: string;
  条件: string[];
  选项: ObjectOf<string>;
  公式: ObjectOf<string>;
}

export interface CadInfo {
  data: CadData;
  errors: (CadInfoError | string)[];
  skipErrorCheck: Set<string>;
}
export interface CadInfoError {
  text: string;
  detail: string;
}
export const addCadInfoError = (cad: CadInfo, error: CadInfoError | string) => {
  const errorText = typeof error === "string" ? error : error.text;
  const found = cad.errors.find((v) => {
    if (typeof v === "string") {
      return v === errorText;
    }
    return v.text === errorText;
  });
  if (found) {
    return;
  }
  cad.errors.push(error);
};
export const addCadInfoErrors = (cad: CadInfo, errors: (CadInfoError | string)[]) => {
  errors.forEach((v) => addCadInfoError(cad, v));
};

/**
 * 算料公式
 */
export interface SlgsInfo {
  data: Slgs;
  errors: string[];
}

/**
 * 型号配置
 */
export interface XinghaoInfo {
  data: ObjectOf<string>;
  errors: string[];
}

export type SourceCadMap = {
  cads: ObjectOf<{
    rect: Rectangle;
    rectLines: CadLineLike[];
    entities: CadEntities;
    text: CadMtext;
  }>;
  slgses: ObjectOf<{text: CadMtext}>;
  xinghao?: {text: CadMtext};
  xinghaoInfo?: {text: CadMtext};
};

export interface PeiheInfoObj {
  type: string;
  options?: {
    is?: ObjectOf<string>;
    isNot?: ObjectOf<(string | null | undefined)[]>;
  };
  hint?: string;
}
export type PeiheInfo = PeiheInfoObj | string;

export type ExportType = "包边正面" | "框型" | "企料" | "框型和企料" | "指定型号" | "自由选择" | "导出选中" | "企料分体" | "导出所有";

export interface CadImportParams {
  sourceCad: CadData;
  maxLineLength?: number;
  导入dxf文件时展开名字不改变?: boolean;
}

export interface CadImportResult {
  cads: CadInfo[];
  slgses: SlgsInfo[];
  sourceCadMap: SourceCadMap;
  xinghaoInfo?: XinghaoInfo;
}

export interface CadSourceParams {
  sourceCad: CadData;
  importResult: CadImportResult;
  xinghaoInfo: ObjectOf<string>;
  slgses: ObjectOf<any>[];
}

export interface CadExportParams {
  cads: CadData[];
  type: ExportType;
  exportId: boolean;
  exportUniqCode: boolean;
  exportOptions: boolean;
  sourceParams?: CadSourceParams;
}

export class CadPortable {
  static cadIncludeFields: (keyof typeof cadFields)[] = [
    "名字",
    "分类",
    "分类2",
    "全部刨坑",
    "板材纹理方向",
    "默认开料板材",
    "算料处理",
    "显示宽度标注",
    "双向折弯",
    "算料特殊要求",
    "算料单显示",
    "装配位置",
    "企料包边门框配合位增加值",
    "对应门扇厚度",
    "主CAD",
    "固定开料板材",
    "条件",
    "对应计算条数的配件",
    "指定板材分组",
    "默认开料材料",
    "默认开料板材厚度",
    "算料单显示放大倍数",
    "自动生成双折宽双折高公式"
  ];
  static infoFields = ["唯一码", "修改包边正面宽规则", "锁边自动绑定可搭配铰边", "使用模板开料"];
  static slgsFields = ["名字", "分类", "条件", "选项", "算料公式"];
  static skipFields = ["模板放大"];
  static xinghaoFields = [
    "门窗",
    "工艺",
    "产品分类",
    "门扇厚度",
    "指定可选锁边",
    "指定可选锁边",
    "默认锁边",
    "默认铰边",
    "大扇做法",
    "小扇做法",
    "门中门门扇背面",
    "框扇同板材",
    "门扇相同",
    "中空高比例",
    "花件前压条",
    "花件后压条",
    "门扇正面压条",
    "门扇背面压条",
    "有背封板",
    "背封板压条",
    "做平开门中门时无背封板",
    "默认花件数量",
    "需要配置花件",
    "独立板材企料分类",
    "使用企料包边做主CAD",
    "前后企料结构指定企料分类",
    "默认前企料结构",
    "默认后企料后结构",
    "企料包边无上下包"
  ];
  static xinghaoFieldsRequired = ["门窗", "工艺", "产品分类", "门扇厚度", "指定可选锁边", "指定可选锁边"];
  static intersectionLayers = ["指定位置刨坑", "分体"];
  static intersectionLayersMap: ObjectOf<"zhidingweizhipaokeng" | "指定分体位置"> = {
    指定位置刨坑: "zhidingweizhipaokeng",
    分体: "指定分体位置"
  };

  static import(params: CadImportParams): CadImportResult {
    const {sourceCad, maxLineLength} = params;
    const lines = sourceCad.entities.line.filter((v) => v.getColor().rgbNumber() === 0x00ff00);
    const lineIds = lines.map((v) => v.id);
    const dumpData = new CadData();

    dumpData.entities.line = lines;
    const rects: Rectangle[] = [];
    const sorted = sortLines(dumpData);

    const getObject = (text: string, separator: string) => {
      text = text + "\n";
      let separatorIndex = -1;
      let key = "";
      let lastKey = "";
      let value = "";
      const obj: ObjectOf<string> = {};
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (separatorIndex === -1) {
          key += char;
        } else {
          value += char;
        }
        if (char === separator) {
          separatorIndex = i;
        }
        if (char === "\n" && key) {
          if (separatorIndex === -1) {
            if (lastKey) {
              obj[lastKey] = `${obj[lastKey]}\n${key}`.trim();
            }
          } else {
            key = key.slice(0, -1).trim();
            obj[key] = value.trim();
            separatorIndex = -1;
            lastKey = key;
          }
          key = "";
          value = "";
        }
      }
      return obj;
    };

    const sourceCadMap: SourceCadMap = {cads: {}, slgses: {}};
    sorted.forEach((group) => {
      const min = new Point(Infinity, Infinity);
      const max = new Point(-Infinity, -Infinity);
      group.forEach(({start, end}) => {
        min.x = Math.min(min.x, start.x, end.x);
        min.y = Math.min(min.y, start.y, end.y);
        max.x = Math.max(max.x, start.x, end.x);
        max.y = Math.max(max.y, start.y, end.y);
      });
      rects.push(new Rectangle(min, max));
    });
    rects.sort((a, b) => {
      const {x: x1, y: y1} = a;
      const {x: x2, y: y2} = b;
      if (Math.abs(y1 - y2) < (a.height + b.height) / 4) {
        return x1 - x2;
      }
      return y1 - y2;
    });

    const layers = sourceCad.export().layers;
    const cads: CadInfo[] = rects.map((rect, i) => {
      const data = new CadData({layers});
      sourceCadMap.cads[data.id] = {rect, rectLines: sorted[i], entities: new CadEntities(), text: new CadMtext()};
      return {data, errors: [], skipErrorCheck: new Set()};
    });
    const slgses: SlgsInfo[] = [];
    const {skipFields, cadIncludeFields} = this;
    const globalOptions: CadData["options"] = {};
    let xinghaoInfo: XinghaoInfo | undefined;
    for (const e of sourceCad.entities.toArray()) {
      if (lineIds.includes(e.id)) {
        continue;
      }
      if (e instanceof CadMtext) {
        const text = replaceChars(e.text);
        const slgsReg = /算料公式[:]?([\w\W]*)/;
        const suanliaoMatch = text.match(slgsReg);
        if (suanliaoMatch) {
          const obj = getObject(text.replace(slgsReg, ""), ":");
          const 公式 = getObject(suanliaoMatch[1], "=");
          for (const key in 公式) {
            if (!公式[key].includes("#")) {
              公式[key] = 公式[key].replaceAll("\n", "");
            }
          }
          const slgsData: ObjectOf<any> = {公式: getObject(suanliaoMatch[1], "=")};
          const errors: string[] = [];
          sourceCadMap.slgses[obj.名字] = {text: e};
          for (const key in obj) {
            const value = obj[key];
            const key2 = cadFields[key as keyof typeof cadFields];
            if (key === "条件") {
              slgsData.条件 = value ? [value] : [];
            } else if (key2 && cadIncludeFields.includes(key2 as any)) {
              if (value === "是") {
                (slgsData[key] as boolean) = true;
              } else if (value === "否") {
                (slgsData[key] as boolean) = false;
              } else {
                (slgsData[key] as string) = value;
              }
            } else if (key !== "唯一码") {
              if (!slgsData.选项) {
                slgsData.选项 = {};
              }
              slgsData.选项[key] = value;
            }
          }
          slgses.push({data: slgsData as Slgs, errors});
          continue;
        }
        const xinghaoMatch = text.match(/^型号:([\w\W]*)/);
        if (xinghaoMatch) {
          sourceCadMap.xinghao = {text: e};
          globalOptions.型号 = xinghaoMatch[1].trim();
        }
        const xinghaoInfoReg = /型号配置:([\w\W]*)/;
        const xinghaoInfoMatch = text.match(xinghaoInfoReg);
        if (xinghaoInfoMatch) {
          sourceCadMap.xinghaoInfo = {text: e};
          xinghaoInfo = {data: {}, errors: []};
          const obj = getObject(xinghaoInfoMatch[1], ":");
          for (const field of this.xinghaoFields) {
            xinghaoInfo.data[field] = obj[field] || "";
          }
          const missingXinghaoFields = this.xinghaoFieldsRequired.filter((v) => !xinghaoInfo?.data[v]);
          if (missingXinghaoFields.length > 0) {
            xinghaoInfo.errors.push(`型号配置缺少以下字段:\n${missingXinghaoFields.join(", ")}`);
          }
          continue;
        }
      }
      slgses.forEach((slgs) => {
        slgs.data.选项 = {...slgs.data.选项, ...globalOptions};
      });
      rects.forEach((rect, i) => {
        let isInRect = false;
        if (e instanceof CadLine && rect.contains(new Line(e.start, e.end))) {
          isInRect = true;
        } else if (e instanceof CadMtext && rect.contains(e.insert)) {
          isInRect = true;
        } else if (e instanceof CadArc && rect.contains(new Line(e.start, e.end))) {
          // ? 判断圆弧是否在矩形内, 此方法不严谨
          isInRect = true;
        } else if (e instanceof CadCircle) {
          const min = e.center.clone().sub(e.radius);
          const max = e.center.clone().add(e.radius);
          if (rect.contains(new Rectangle(min, max))) {
            isInRect = true;
          }
        } else if (e instanceof CadDimension) {
          const pts = sourceCad.getDimensionPoints(e);
          if (pts.every((p) => rect.contains(p))) {
            isInRect = true;
          }
        } else if (e instanceof CadLeader) {
          const pts = e.vertices;
          if (pts.length === 2 && rect.contains(pts[1])) {
            isInRect = true;
          }
        }
        if (isInRect) {
          cads[i].data.entities.add(e.clone());
          sourceCadMap.cads[cads[i].data.id].entities.add(e);
        }
      });
    }

    const emptyCad = new CadData();
    cads.forEach((cad) => {
      const data = cad.data;
      let toRemove = -1;
      this._extractIntersections(data);
      data.info.errors = [];
      data.options = {...globalOptions};
      const found = data.entities.mtext.some((e, i) => {
        const text = replaceChars(e.text);
        if (text.startsWith("唯一码")) {
          toRemove = i;
          sourceCadMap.cads[data.id].text = e;
          const obj = getObject(text, ":");
          let zhankaiObjs: ObjectOf<any>[] = [];
          for (const key in obj) {
            if (skipFields.includes(key)) {
              continue;
            }
            const value = obj[key];
            if (key === "展开") {
              zhankaiObjs = Array.from(value.matchAll(/\[([^\]]*)\]/g)).map((vv) => {
                const arr = vv[1].split(",").map((v) => v.trim());
                if (obj.分类 === "包边正面") {
                  if (!arr[1].includes(";")) {
                    if (arr.length < 3) {
                      cad.errors.push("包边正面展开必须至少有3项, 有两个展开高");
                    }
                    arr[1] = arr[1] + "," + arr[2];
                    arr.splice(2, 1);
                  }
                }
                const zhankaikuan = arr[0];
                const zhankaigao = arr[1];
                const shuliang = arr[2];
                const conditions = arr.slice(3);
                for (const vvv of [zhankaikuan, zhankaigao, shuliang]) {
                  if (vvv && vvv.match(/['"]/)) {
                    cad.errors.push("展开宽, 展开高和数量不能有引号");
                    break;
                  }
                }
                return {zhankaikuan, zhankaigao, shuliang, conditions};
              });
              continue;
            }
            obj[key] = value;
            const key2 = cadFields[key as keyof typeof cadFields];
            if (key === "对应计算条数的配件") {
              data.对应计算条数的配件 = getObject(value, "=");
            } else if (key2) {
              if (cadIncludeFields.includes(key as any)) {
                const defaultValue = emptyCad[key2];
                if (typeof defaultValue === "boolean") {
                  (data[key2] as boolean) = value === "是";
                } else if (Array.isArray(defaultValue)) {
                  (data[key2] as string[]) = this.splitOptionValue(value);
                } else {
                  (data[key2] as string) = value;
                }
              }
            } else if (this.infoFields.includes(key)) {
              data.info[key] = value;
            } else {
              if (globalOptions[key]) {
                cad.errors.push(`多余的选项【${key}】`);
              } else {
                const optionValues = this.splitOptionValue(value);
                data.options[key] = this.joinOptionValue(optionValues);
              }
            }
          }
          data.zhankai = zhankaiObjs.map((o, j) => {
            if (j > 0) {
              let name = data.name;
              if (!params.导入dxf文件时展开名字不改变) {
                name += j + 1;
              }
              return new CadZhankai({...o, name});
            } else {
              return new CadZhankai(o);
            }
          });
          return true;
        }
        return false;
      });
      if (!found) {
        data.info.errors.push("找不到以唯一码开头的文本");
        data.info.isEmpty = true;
        return;
      }
      if (toRemove >= 0) {
        data.entities.mtext.splice(toRemove, 1);
      }

      const vars: ObjectOf<string> = {};
      data.info.vars = vars;
      const isShiyituCad = isShiyitu(data);
      data.entities.forEach((e) => {
        if (e instanceof CadDimensionLinear) {
          e.cad1 = data.name;
          e.cad2 = data.name;
        }
        if (e instanceof CadLineLike) {
          const varName = e.info.varName;
          if (varName) {
            vars[varName] = e.id;
          }
          delete e.info.varName;
          if (isShiyituCad) {
            e.hideLength = true;
          }
        }
      });
      for (const e of [...data.entities.line, ...data.entities.arc]) {
        const varName = e.info.varName;
        if (varName) {
          data.info.vars[varName] = e.id;
        }
        delete e.info.varName;
      }

      if (typeof maxLineLength === "number" && !isShiyituCad && !data.shuangxiangzhewan && maxLineLength > 0) {
        const linesToSet = data.entities.line.filter((e) => e.gongshi && e.length > maxLineLength);
        setLinesLength(data, linesToSet, maxLineLength);
      }
      generateLineTexts2(data);

      autoShuangxiangzhewan(data);
    });
    return {cads, slgses, sourceCadMap, xinghaoInfo};
  }

  static async export(params: CadExportParams, projectConfig: ProjectConfig) {
    const margin = 300;
    const padding = 80;
    const width = 855;
    const height = 1700;
    const cols = 10;
    const {type, exportId, exportUniqCode, exportOptions} = params;
    const {sourceCad, importResult, xinghaoInfo, slgses} = params.sourceParams || {};
    const cads = params.cads.filter((v) => v.entities.length > 0);
    const emptyData = new CadData();

    const groupedCads: (CadData[] | null)[] = [];
    if (type === "框型和企料") {
      const infoObj: ObjectOf<PeiheInfo[]> = {
        锁企料: ["锁框", "顶框", "小锁料", "扇锁企料", "中锁料"],
        铰企料: ["中铰料", "铰框"]
      };
      const groups = {
        锁企料: [] as CadData[],
        铰企料: [] as CadData[]
      };
      const others: CadData[] = [];
      cads.forEach((cad) => {
        const types = this.getTypes(cad);
        let found = false;
        for (const key of keysOf(groups)) {
          if (types.includes(key)) {
            groups[key].push(cad);
            found = true;
            break;
          }
        }
        if (!found) {
          others.push(cad);
        }
      });
      const othersIds = new Set<string>();
      for (const key of keysOf(groups)) {
        groups[key].forEach((cad) => {
          const arr = [cad];
          groupedCads.push(arr);
          const options1 = this.getOptions(cad.options);
          const types = infoObj[key].map((v) => (typeof v === "string" ? v : v.type));
          for (const cad2 of others) {
            if (intersection(this.getTypes(cad2), types).length < 1) {
              continue;
            }
            const options2 = this.getOptions(cad2.options);
            let found = true;
            for (const key2 in options1) {
              if (!options2[key2] || options2[key2].length < 1) {
                continue;
              }
              if (intersection(options1[key2], options2[key2]).length < 1) {
                found = false;
                break;
              }
            }
            if (found) {
              othersIds.add(cad2.id);
              arr.push(cad2.clone(true));
            }
          }
        });
      }
      groupedCads.push(null);
      groupedCads.push(others.filter((v) => !othersIds.has(v.id)));
    } else {
      cads.forEach((cad, i) => {
        if (i % cols === 0) {
          groupedCads.push([cad]);
        } else {
          groupedCads[groupedCads.length - 1]?.push(cad);
        }
      });
    }

    const rect = new Rectangle();
    const ids = [] as string[];
    const dividers = [] as number[];
    let result: CadData;
    const isXinghao = !!xinghaoInfo;
    if (sourceCad) {
      result = sourceCad;
      rect.copy(sourceCad.entities.getBoundingRect());
    } else {
      result = new CadData();
    }
    result.info.version = CadVersion.DXF2010;
    const toRemove = new Set(Object.keys(importResult?.sourceCadMap.cads || []));
    for (let i = 0; i < groupedCads.length; i++) {
      const group = groupedCads[i];
      if (group === null) {
        dividers.push(rect.bottom - margin / 2);
        continue;
      }

      const group2 = [] as CadData[];
      const right = rect.right + padding;
      const draw = async (cad: CadData, j: number, isGroup2: boolean) => {
        showIntersections(cad, projectConfig);
        const cadRect = cad.getBoundingRect();
        let offsetX = j * (width + margin);
        let offsetY = -(i - dividers.length) * (height + margin);
        if (isGroup2) {
          offsetX += right + margin + 1000;
          offsetY += rect.top - (offsetY + height);
        }
        const translate = new Point(offsetX + (width - cadRect.width - padding * 2) / 2, offsetY + height - padding);
        translate.sub(cadRect.left, cadRect.top);
        cad.transform({translate}, true);
        cadRect.transform({translate});

        const texts = [];
        if (exportUniqCode) {
          texts.push(`唯一码: ${cad.info.唯一码}`);
        } else {
          texts.push("唯一码: ");
        }
        const {skipFields, cadIncludeFields} = this;
        for (const key of keysOf(cadFields)) {
          if (skipFields.includes(key) || !cadIncludeFields.includes(key)) {
            continue;
          }
          const value = cad[cadFields[key]];
          const defaultValue = emptyData[cadFields[key]];
          if (!isEqual(value, defaultValue)) {
            const text = getValueString(value);
            if (text) {
              texts.push(`${key}: ${text}`);
            }
          }
        }
        if (exportOptions) {
          for (const optionName in cad.options) {
            if (isXinghao && optionName === "型号") {
              continue;
            }
            texts.push(`${optionName}: ${cad.options[optionName]}`);
          }
        }
        const zhankaiStr = cad.zhankai
          .map((v) => {
            const arr = [v.zhankaikuan, v.zhankaigao, v.shuliang];
            arr.push(...v.conditions);
            return `[${arr.join(", ")}]`;
          })
          .join(", ");
        texts.push(`展开: ${zhankaiStr}`);
        if (cad.shuangxiangzhewan) {
          texts.push("双向折弯: 是");
        }
        for (const key of this.infoFields) {
          if (key === "唯一码") {
            continue;
          }
          const value = cad.info[key];
          if (value) {
            texts.push(`${key}: ${value}`);
          }
        }
        {
          const key = Object.keys(cad.对应计算条数的配件)[0];
          const value = cad.对应计算条数的配件[key];
          if (key && value) {
            texts.push(`对应计算条数的配件: ${key}=${value}`);
          }
        }

        if (importResult && !isGroup2) {
          const uniqCode = cad.info.唯一码;
          let found = false;
          for (const cad2 of importResult.cads) {
            const uniqCode2 = this.getUniqCode(cad2.data, null, null);
            if (uniqCode === uniqCode2) {
              found = true;
              toRemove.delete(cad2.data.id);
              const entities1 = cad.entities;
              const entities2 = cad2.data.entities;
              const rect1 = entities1.getBoundingRect();
              const rect2 = entities2.getBoundingRect();
              const dx = rect2.left - rect1.left;
              const dy = rect2.top - rect1.top;
              entities1.transform({translate: [dx, dy]}, true);
              const text = importResult.sourceCadMap.cads[cad2.data.id].text;
              result.entities.separate(entities2);
              result.entities.merge(entities1);
              for (const e of result.entities.mtext) {
                if (e.id === text.id) {
                  e.text = texts.join("\n");
                  break;
                }
              }
            }
          }
          if (!found) {
            group2.push(cad);
          }
        } else {
          cad.entities.add(
            new CadMtext({
              text: texts.join("\n"),
              insert: [offsetX + padding, cadRect.bottom - padding],
              anchor: [0, 0]
            })
          );
          const {line: lines, arc: arcs} = cad.getAllEntities();
          [...lines, ...arcs].forEach((e) => this._addLineInfoDimension(cad, e, exportId));

          let color: number;
          if (ids.includes(cad.id)) {
            color = 7;
          } else {
            ids.push(cad.id);
            color = 3;
          }
          [
            [0, 0, width, 0],
            [width, 0, width, height],
            [width, height, 0, height],
            [0, height, 0, 0]
          ].forEach((v) => {
            const start = [v[0] + offsetX, v[1] + offsetY];
            const end = [v[2] + offsetX, v[3] + offsetY];
            cad.entities.add(new CadLine({color, start, end}));
          });
          rect.expandByPoint([offsetX, offsetY]);
          rect.expandByPoint([offsetX + width, offsetY + height]);

          result.entities.merge(cad.getAllEntities());
        }
      };
      for (let j = 0; j < group.length; j++) {
        await draw(group[j], j, false);
      }
      for (let j = 0; j < group2.length; j++) {
        await draw(group2[j], j, true);
      }
    }
    if (importResult) {
      toRemove.forEach((id) => {
        const {entities, rectLines} = importResult.sourceCadMap.cads[id];
        entities.forEach((e) => result.entities.remove(e));
        rectLines.forEach((e) => result.entities.remove(e));
      });
    }

    dividers.forEach((y) => {
      const divider = new CadLine({color: 6});
      divider.start.set(rect.left - margin, y);
      divider.end.set(rect.right + margin, y);
      result.entities.add(divider);
    });

    if (importResult) {
      const {sourceCadMap} = importResult;
      let offsetX = rect.left - 3000;
      const offsetXStep = 2000;
      if (slgses) {
        const names: string[] = [];
        for (const slgs of slgses) {
          let mtext = sourceCadMap.slgses[slgs.名字]?.text;
          const obj = {名字: slgs.名字, 分类: slgs.分类, 条件: slgs.条件} as ObjectOf<string>;
          for (const optionName in slgs.选项) {
            if (isXinghao && optionName === "型号") {
              continue;
            }
            obj[optionName] = slgs.选项[optionName];
          }
          let text = "";
          for (const key in obj) {
            text += `${key}: ${obj[key] || ""}\n`;
          }
          text += "算料公式:\n";
          for (const key in slgs.公式) {
            text += `${key} = ${slgs.公式[key]}\n`;
          }
          if (mtext) {
            names.push(slgs.名字);
            mtext.text = text;
          } else {
            mtext = new CadMtext();
            mtext.text = text;
            mtext.anchor.set(0, 0);
            mtext.insert.set(offsetX, rect.top);
            offsetX -= offsetXStep;
            mtext.fontStyle.size = 50;
            result.entities.add(mtext);
          }
        }
        for (const name in sourceCadMap.slgses) {
          if (!names.includes(name)) {
            sourceCadMap.slgses[name].text.text = "";
          }
        }
      }
      if (xinghaoInfo) {
        let mtext = sourceCadMap.xinghaoInfo?.text;
        if (!mtext) {
          mtext = new CadMtext();
          mtext.anchor.set(0, 0);
          mtext.insert.set(offsetX, rect.top);
          offsetX -= offsetXStep;
          mtext.fontStyle.size = 50;
          result.entities.add(mtext);
        }
        const strs = [] as string[];
        this.xinghaoFields.forEach((field) => {
          strs.push(`${field}: ${xinghaoInfo[field] || ""}`);
        });
        mtext.text = `型号配置: \n\n${strs.join("\n")}`;
      }
    }
    return result;
  }

  static getTypes(cad: CadData) {
    let types = Array.from(new Set(cad.type.split(";").concat(cad.type2.split(";"))));
    if (intersection(types, ["锁企料", "扇锁企料"]).length === 2) {
      types = difference(types, ["锁企料"]);
    }
    return types;
  }

  static addLineId(cad: CadData) {
    const lineGroups = sortLines(cad);
    if (lineGroups.length < 1 || lineGroups.length > 2) {
      return;
    }
    lineGroups.sort((a, b) => {
      const {left: left1, top: top1} = new CadEntities().fromArray(a).getBoundingRect();
      const {left: left2, top: top2} = new CadEntities().fromArray(b).getBoundingRect();
      return left1 === left2 ? top1 - top2 : left1 - left2;
    });
    const uniqCode = cad.info.唯一码 || "";

    lineGroups.forEach((lines, i) => {
      const prefix = lineGroups.length > 1 ? `${uniqCode}-${i + 1}` : uniqCode;
      const l1 = lines[0];
      const l2 = lines[lines.length - 1];
      const p1 = new Point(l1.minX, l1.minY);
      const p2 = new Point(l2.minX, l2.minY);
      if (p1.x === p2.x ? p1.y > p2.y : p1.x > p2.x) {
        lines = lines.reverse();
      }
      lines.forEach((line, j) => {
        if (line.线id) {
          return;
        }
        if (line.mingzi) {
          line.线id = `${prefix}-${line.mingzi}`;
        } else {
          line.线id = `${prefix}-${j + 1}`;
        }
      });
    });
  }

  static splitOptionValue(str: string | undefined | null) {
    if (typeof str !== "string") {
      return [];
    }
    return str.replaceAll(" ", "").split(";").filter(Boolean);
  }

  static joinOptionValue(strs: string[]) {
    return strs.filter(Boolean).join(";");
  }

  static getOptions(options: CadData["options"]) {
    const result: ObjectOf<string[]> = {};
    for (const key in options) {
      result[key] = this.splitOptionValue(options[key]);
    }
    return result;
  }

  static hasPeiheCad(cads: CadData[], info: PeiheInfo, options: ObjectOf<string>) {
    if (typeof info === "string") {
      info = {type: info, options: {}};
    }
    const type = info.type;
    const {is, isNot} = info.options || {};
    const result: {options: ObjectOf<string[]>; value: boolean} = {options: {}, value: false};
    cads.forEach((cad) => {
      if (cad.type !== type && cad.type2 !== type) {
        return;
      }
      if (is) {
        for (const optionName in is) {
          if (!is[optionName].includes(cad.options[optionName])) {
            return;
          }
        }
      }
      if (isNot) {
        for (const optionName in isNot) {
          if (isNot[optionName].includes(cad.options[optionName])) {
            return;
          }
        }
      }
      for (const optionName in options) {
        const values1 = this.splitOptionValue(options[optionName]);
        const values2 = this.splitOptionValue(cad.options[optionName]);
        if (values2.length < 1 || cad.options[optionName] === "所有") {
          continue;
        }
        if (intersection(values1, values2).length < 1) {
          return;
        }
      }
      for (const optionName in options) {
        this.splitOptionValue(cad.options[optionName]).forEach((v) => {
          if (!result.options[optionName]) {
            result.options[optionName] = [v];
          } else if (!result.options[optionName].includes(v)) {
            result.options[optionName].push(v);
          }
        });
      }
    });
    if (info.type === "小锁料") {
      if (!result.options.产品分类) {
        result.options.产品分类 = [];
      }
      result.options.产品分类.push("单门");
    }
    for (const optionName in options) {
      if (difference(this.splitOptionValue(options[optionName]), result.options[optionName]).length > 0) {
        return result;
      }
    }
    result.value = true;
    return result;
  }

  static getUniqCode(cad: CadData, importCache: ImportCache | null, user: AppUser | null) {
    const {name, type} = cad;
    const get = (key: string) => cad.options[key] || "";
    const arr = [
      type,
      get("型号"),
      get("开启"),
      get("锁向"),
      get("门铰"),
      get("门扇厚度"),
      get("产品分类"),
      get("锁边"),
      get("铰边"),
      get("包边"),
      get("门中门门扇背面"),
      get("门扇正面"),
      get("大扇做法"),
      get("小扇做法"),
      get("工艺"),
      get("底框吊脚"),
      get("假门头"),
      get("门框加厚"),
      get("顶框分体"),
      get("配件模块"),
      name
    ];
    if (importCache?.lurushuju) {
      arr.push(Date.now().toString() + uniqueId());
    }
    if (user) {
      arr.push(String(user.vid));
    }
    return arr.join("");
  }

  private static _extractIntersections(cad: CadData) {
    const entities = cad.entities;
    const map = generatePointsMap(cad.entities);
    const tol = 5;
    entities.forEach((e) => {
      if (!this.intersectionLayers.includes(e.layer)) {
        e.layer = this.intersectionLayers[0];
      }
      let p: Point | undefined;
      if (e instanceof CadLeader) {
        p = e.vertices[0];
      } else if (e instanceof CadCircle) {
        p = e.center;
      }
      if (!p) {
        return;
      }
      for (const v of map) {
        if (v.lines.length === 2 && p.distanceTo(v.point) <= tol) {
          cad[this.intersectionLayersMap[e.layer]].push([v.lines[0].id, v.lines[1].id]);
          entities.remove(e);
          break;
        }
      }
    });
  }

  private static _addLineInfoDimension(cad: CadData, e: CadLineLike, exportId: boolean) {
    const dimension = new CadDimensionLinear();
    dimension.layer = "line-info";
    dimension.dimstyle = "line-info";
    dimension.distance = 10;
    dimension.setColor("red");
    dimension.entity1 = {id: e.id, location: "start"};
    dimension.entity2 = {id: e.id, location: "end"};
    const tmp = new CadLine();

    const texts = [];
    if (exportId) {
      if (e.线id) {
        texts.push(`{\\H0.1x;线id:${e.线id}}`);
      } else {
        texts.push(`{\\H0.1x;id:${e.id}}`);
      }
    }
    let mingzi = e.mingzi;
    const vars = cad.info.vars;
    if (vars) {
      for (const varName in vars) {
        if (vars[varName] === e.id) {
          mingzi = varName;
        }
      }
    }
    const {qujian, gongshi} = e;
    const qujianMatch = qujian.match(/(\d+)[~-](\d+)/);
    let mingziAdded = false;
    if (qujianMatch) {
      const [left, right] = qujianMatch.slice(1);
      const leftNum = Number(left);
      const rightNum = Number(right);
      if (!isNaN(leftNum) && leftNum <= 0) {
        texts.push(`${mingzi}<=${right}`);
      } else if (!isNaN(rightNum) && rightNum >= 9999) {
        texts.push(`${mingzi}>=${left}`);
      } else {
        texts.push(`${mingzi}=${left}-${right}`);
      }
      mingziAdded = true;
    }
    if (gongshi) {
      texts.push(`${mingzi}=${gongshi}`);
      mingziAdded = true;
    }
    if (!mingziAdded) {
      texts.push(mingzi);
    }
    if (e.children.line.find((v) => v.宽高虚线)) {
      texts.push("显示斜线宽高");
    }
    const lineKeys: ObjectOf<keyof CadLineLike> = {
      显示线长: "显示线长",
      下一个折弯标线: "nextZhewan",
      展开方式: "zhankaifangshi",
      指定展开长: "zidingzhankaichang",
      双向折弯附加值: "双向折弯附加值"
    };
    for (const k in lineKeys) {
      const v = e[lineKeys[k]];
      if (v && v !== tmp[lineKeys[k]]) {
        texts.push(`${k}: ${v}`);
      }
    }
    dimension.mingzi = texts.join("\n");
    if (dimension.mingzi.length > 0) {
      const e2 = e instanceof CadLine ? e : new CadLine({start: e.start, end: e.end});
      if (e2.isHorizontal()) {
        dimension.axis = "x";
      } else if (e2.isVertical()) {
        dimension.axis = "y";
      }
      cad.entities.add(dimension);
    }
  }
}
