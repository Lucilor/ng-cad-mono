import {Formulas} from "@app/utils/calc";
import {TableDataBase} from "@app/utils/table-data/table-data-base";
import {getTrbl, Trbl, trblItems} from "@app/utils/trbl";
import {输入} from "@components/lurushuju/xinghao-data";
import {isBetween, isTypeOf, Rectangle} from "@lucilor/utils";
import {CalcService} from "@services/calc.service";

export interface YahuabanItem extends TableDataBase {
  guige: [number, number];
  targetSize: [number, number];
  qiegemoshi: string;
  qiegeliubian: Trbl;
  shangxiazuoyoukeqiegezhi: Trbl;
  gongshishuru?: 输入[];
  gongshishuruResult?: Formulas;
  qiegegongshi?: Formulas;
  shiyitu?: string;
}

export interface CalcYahuabanResult {
  rawRect: Rectangle;
  liubanRect: Rectangle;
  keqiegeRect: Rectangle;
  targetRect: Rectangle;
  errors: string[];
  targetOffset: Trbl;
}
export interface CalcYahuabanConfig {
  targetOffset?: Trbl;
}

export const calcYahuaban = async (item: YahuabanItem, calc: CalcService, config?: CalcYahuabanConfig) => {
  const errors: string[] = [];

  const {qiegegongshi = {}, gongshishuruResult} = item;
  const calcResult = await calc.calcFormulas(qiegegongshi, gongshishuruResult, {});
  if (!calcResult?.fulfilled) {
    errors.push("公式计算出错");
  }
  const vars = calcResult?.succeed || {};

  const {qiegeliubian: liubian, shangxiazuoyoukeqiegezhi: keqiege} = item;
  const spaces = trblItems.map(({index}) => keqiege[index] - liubian[index]);
  for (const {name, index} of trblItems) {
    if (spaces[index] < 0) {
      errors.push(`${name}可切割${spaces[index]}`);
    }
  }

  const [rawWidth, rawHeight] = item.guige;
  const [targetWidth, targetHeight] = item.targetSize;
  const dWidth = rawWidth - targetWidth;
  const dHeight = rawHeight - targetHeight;
  if (dWidth < 0) {
    errors.push("成型宽大于物料宽");
  }
  if (dHeight < 0) {
    errors.push("成型高大于物料高");
  }

  let targetOffset: Trbl;
  if (config?.targetOffset) {
    targetOffset = config.targetOffset;
  } else {
    targetOffset = getTrbl(0);
    const {qiegemoshi: mode} = item;
    const getNum = (key: string, modeStr: string, defaultNum: number) => {
      let num = vars[key];
      if (isTypeOf(num, ["null", "undefined"])) {
        errors.push(`切割模式为【${modeStr}】但没有定义【${key}】`);
        return defaultNum;
      }
      num = Number(num);
      if (!(num > 0)) {
        errors.push(`切割模式为【${modeStr}】但【${key}】不大于0`);
        return defaultNum;
      }
      return num;
    };
    if (mode.includes("上下居中")) {
      targetOffset[0] = dHeight / 2;
      targetOffset[2] = targetOffset[0];
    } else if (mode.includes("切上")) {
      targetOffset[2] = getNum("下切割", "切上", liubian[2]);
      targetOffset[0] = dHeight - targetOffset[2];
    } else if (mode.includes("切下")) {
      targetOffset[0] = getNum("上切割", "切下", liubian[0]);
      targetOffset[2] = dHeight - targetOffset[0];
    } else {
      errors.push("切割模式没写上下切");
    }
    if (mode.includes("左右居中")) {
      targetOffset[3] = dWidth / 2;
      targetOffset[1] = targetOffset[3];
    } else if (mode.includes("切左")) {
      targetOffset[1] = getNum("右切割", "切左", liubian[1]);
      targetOffset[3] = dWidth - targetOffset[1];
    } else if (mode.includes("切右")) {
      targetOffset[3] = getNum("左切割", "切右", liubian[3]);
      targetOffset[1] = dWidth - targetOffset[3];
    } else {
      errors.push("切割模式没写左右切");
    }
    for (const {name, index} of trblItems) {
      if (!isBetween(targetOffset[index], liubian[index], keqiege[index], true)) {
        errors.push(`${name}切超出范围`);
      }
    }
  }

  const rawRect = new Rectangle([0, 0], [rawWidth, rawHeight]);
  const shrink = (offset: Trbl) => {
    const rect = rawRect.clone();
    rect.top -= offset[0];
    rect.left += offset[3];
    rect.right -= offset[1];
    rect.bottom += offset[2];
    return rect;
  };
  return {
    rawRect,
    liubanRect: shrink(liubian),
    keqiegeRect: shrink(keqiege),
    targetRect: shrink(targetOffset),
    errors,
    targetOffset,
    vars
  };
};
