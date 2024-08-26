import {isTypeOf, ObjectOf} from "@lucilor/utils";
import {isEmpty, trim, uniq} from "lodash";
import {toFixed} from "../func";
import {CalcCircularReferenceError, CalcSelfReferenceError} from "./errors";
import {ExpressionDeps, ExpressionInfo, FormulaInfo, Formulas} from "./types";

export class Calc {
  private static _builtins: string[] = [
    "round",
    "floor",
    "ceil",
    "rand",
    "abs",
    "min",
    "max",
    "sqrt",
    "log",
    "exp",
    "pow",
    "=",
    "strpos",
    "true",
    "false"
  ];
  private static _opsReg = /[+\\\-x*/()|&!?:>< =,%]+/g;
  private static _opsArr = ["+", "\\", "-", "x", "*", "/", "(", ")", "|", "&", "!", "?", ":", ">", "<", " ", "=", ",", "%"];

  private static replaceString(str: string, search: string[], replace: string[]) {
    search.forEach((v, i) => (str = str.replaceAll(v, replace[i])));
    return str;
  }

  /**
   * 提取公式中的变量
   */
  public static getVars(expression: string) {
    const {_opsReg, _builtins} = this;
    return uniq(expression.split(_opsReg)).filter((v) => !_builtins.includes(v.toLowerCase()) && isNaN(Number(v)) && v.match(/^[^'^"]+/));
  }

  /**
   * 用数字替换表达式中的变量
   */
  public static replaceVars(expression: string, pairs: Formulas = {}) {
    const search = ["（", "）", "，", "。", " ", "‘", "’", "“", "”", "FALSE", "TRUE"];
    const replace = ["\\(", "\\)", ",", "\\.", "", "'", "'", '"', '"', "false", "true"];
    expression = this.replaceString(expression, search, replace);
    const vars = this.getVars(expression);
    expression = `(${expression})`;
    vars
      .sort(
        (a, b) =>
          // 越长的越先匹配
          b.length - a.length
      )
      .forEach((v) => {
        const reg = /^#(.*)#$/;
        if (reg.test(v)) {
          const v2 = v.replace(reg, "$1");
          if (pairs[v2] != null) {
            expression = expression.replaceAll(v, String(pairs[v2]));
          }
          return;
        }
        let value = pairs[v];

        if (value == null) {
          return;
        }

        if (typeof value === "number") {
          value = value.toString();
        } else if (value === "" || isNaN(Number(value)) || v === "花件名字") {
          value = this.replaceString(value, search, replace);
          value = `'${value}'`;
        }

        let pos = 0;

        let replaceTimes = 0;
        // NOTE: 周期CAD可能会有二三十个也不一定的，不能设的太小
        const maxReplaceTimes = 50;

        do {
          pos = expression.indexOf(v, pos);

          if (pos !== -1) {
            const prevChar = expression[pos - 1];
            const nextChar = expression[pos + v.length];

            const prevCharIsValid = !prevChar || this._opsArr.includes(prevChar);
            const nextCharIsValid = !nextChar || this._opsArr.includes(nextChar);

            if (prevCharIsValid && nextCharIsValid) {
              expression = expression.substring(0, pos) + value + expression.substring(pos + v.length);
              replaceTimes++;
              pos += value.length;
            } else {
              pos += v.length;
            }
          }
        } while (pos !== -1 && replaceTimes < maxReplaceTimes);
      });

    return expression.substring(1, expression.length - 1);
  }

  public static validateExpression(expression: string | number) {
    const result: {valid: boolean; error: string | null} = {valid: true, error: ""};
    if (typeof expression === "number") {
      if (isNaN(expression)) {
        result.valid = false;
        result.error = "NaN";
      }
      result.valid = !isNaN(expression);
      return result;
    }
    const vars = this.getVars(expression);
    const pairs: ObjectOf<number> = {};
    for (const v of vars) {
      pairs[v] = 0;
    }
    const {error} = this.calcExpress(expression, pairs);
    result.valid = error !== null;
    result.error = error;
    return result;
  }

  public static validateFormulas(formulas: Formulas) {
    this.sortFormulas(formulas);
    const errors: string[] = [];
    for (const key in formulas) {
      const value = formulas[key];
      const result = this.validateExpression(value.toString());
      if (!result.valid) {
        let error = result.error;
        if (!error) {
          error = "语法错误";
        }
        errors.push(`${value} ,<span style='color:red'>${error}</span>`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`以下公式有错：<br>${errors.join("<br>")}`);
    }
  }

  public static mergeFormulas(target: Formulas, ...sources: Formulas[]) {
    for (const source of sources) {
      for (const key in source) {
        const value = source[key];
        if (value === null || value === undefined) {
          continue;
        }
        target[key] = value;
      }
    }
  }

  public static generateExpressDirect(expression: string, dic: Formulas = {}): string {
    // dic中可能有中文
    if (typeof dic !== "object") {
      throw new Error("传入的数据格式错误！");
    }

    expression = this.replaceVars(trim(expression, "+"), dic);

    "$\\{".split("").forEach((char) => {
      if (expression.includes(char)) {
        throw new Error(`错误！非法表达式: ${char}, ${expression}`);
      }
    });

    expression = expression.replaceAll("--", "+");
    if (expression.includes("/-")) {
      throw new Error("表达式错误：" + expression);
    }

    return expression;
  }

  /**
   * 计算前请调用generateExpressDirect生成最终表达式用于计算
   * 直接计算表达式
   *
   * @param expression
   * @param dic
   * @returns
   */
  public static calcExpressDirect(expression: string) {
    return window.eval(expression);
  }

  /**
   * 计算表达式并捕获错误
   *
   * @param expression
   * @param dic
   * @returns
   */
  public static calcExpress(expression: string, dic: Formulas = {}) {
    initCalc();
    const rawExpression = expression;

    const result: {
      value: any;
      error: string | null;
      expression: string | null;
    } = {
      value: null,
      error: null,
      expression: null
    };

    try {
      result.expression = this.generateExpressDirect(expression, dic);
      result.value = this.calcExpressDirect(result.expression);
    } catch (e) {
      if (e instanceof Error) {
        result.error = e.message;
      } else {
        result.error = `无法计算: ${expression}\n${rawExpression}`;
      }
    }

    return result;
  }

  /**
   * 计算数组或字典的深度
   *
   * @param obj
   * @returns
   */
  private static getDepth(obj: any[] | ObjectOf<any>) {
    let maxDepth = 1;
    if (Array.isArray(obj)) {
      obj.forEach((v) => {
        if (Array.isArray(v)) {
          maxDepth += Math.max(maxDepth, this.getDepth(v) + 1);
        }
      });
    } else {
      for (const key in obj) {
        maxDepth = Math.max(maxDepth, this.getDepth(obj[key]) + 1);
      }
    }
    return maxDepth;
  }

  /**
   * 获取表达式中变量的依赖关系
   *
   * @param map
   * @param info
   * @param originVar
   * @returns
   */
  private static getExpressionDeps(
    map: ObjectOf<ExpressionInfo>,
    info: ExpressionInfo,
    originVar: string | null = null,
    depth = 0
  ): ExpressionDeps {
    const deps: ExpressionDeps = {};
    const exp = info.exp;
    const vars = info.vars;
    if (exp.includes("\n")) {
      return deps;
    }
    vars.forEach((v) => {
      const nextInfo = map[v];
      if (nextInfo) {
        const nextVars = nextInfo.vars;
        if (nextVars.includes(v)) {
          // singleAlert(
          //     `错误！算料公式，自引用死循环<br><br>${v} <span style='color:red;'>=></span> ${map[v].exp}`,
          //     {area: ["70%", "80%"]},
          //     true,
          //     true
          // );
          throw new CalcSelfReferenceError(v, map[v].exp);
        }
        if (originVar) {
          if (nextVars.includes(originVar)) {
            throw new CalcCircularReferenceError(v, map[v].exp, originVar, map[originVar].exp);
          }

          if (depth >= 30) {
            throw new CalcCircularReferenceError(v, map[v].exp, originVar, map[originVar].exp);
          }
        }
        deps[v] = this.getExpressionDeps(map, map[v], v, depth + 1);
      } else {
        deps[v] = this.getVars(exp);
      }
    });
    return deps;
  }

  /**
   * 将公式按照变量的依赖深度从小到大排序
   */
  private static sortFormulas(formulas: Formulas) {
    const map: ObjectOf<ExpressionInfo> = {};
    for (const key in formulas) {
      const exp = formulas[key].toString();
      map[key] = {exp, vars: this.getVars(exp)};
    }
    const formulasGroup: ObjectOf<ObjectOf<FormulaInfo>> = {};
    for (const key in map) {
      const value = map[key];
      const deps = this.getExpressionDeps(map, value, key);
      const depth = this.getDepth(deps);
      if (formulasGroup[depth] === undefined) {
        formulasGroup[depth] = {};
      }
      formulasGroup[depth][key] = {
        vars: value.vars,
        depth,
        deps,
        exp: formulas[key].toString()
      };
    }
    const sortedKeys = [] as string[];
    const sortedFormulas: ObjectOf<FormulaInfo> = {};
    Object.keys(formulasGroup)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((k) => {
        for (const kk in formulasGroup[k]) {
          sortedKeys.push(kk);
          sortedFormulas[kk] = formulasGroup[k][kk];
        }
      });
    return {sortedFormulas, sortedKeys};
  }

  /**
   * 根据参数计算公式
   */
  public static calcFormulas(formulas: Formulas, vars: Formulas = {}) {
    const error: ObjectOf<string> = {};
    const maybeError: ObjectOf<string> = {}; // 计算结果小于等于0
    formulas = {...formulas};
    for (const key in formulas) {
      const value = formulas[key];
      if (isTypeOf(value, ["NaN", "null", "undefined"])) {
        formulas[key] = "";
      }
    }
    const {sortedFormulas, sortedKeys} = this.sortFormulas(formulas);
    vars = {...vars};

    const formulasRaw = {...formulas};
    const input: Formulas = vars.input && typeof vars.input === "object" ? vars.input : {};

    // 先将输入值拿出来
    for (const key in input) {
      const value = input[key];
      const num = Number(value);
      if (!isNaN(num) && num !== 0) {
        delete formulas[key];
        vars[key] = value;
      }
    }

    for (const name of sortedKeys) {
      const expression = formulas[name];
      if (typeof expression === "string" && expression.length < 1) {
        delete formulas[name];
        continue;
      }

      if (name.endsWith("范围")) {
        delete formulas[name];
        vars[name] = expression;
        continue;
      }

      // 使用输入值input
      if (input[name] !== undefined) {
        const val = input[name];
        const valNum = Number(val);
        if (isNaN(valNum)) {
          throw new Error(`错误！公式计算中，输入参数不是数字！【${name}，${val}】`);
        } else {
          vars[name] = valNum;
          delete formulas[name];
        }
      } else {
        // 去除fomulas中的数字，并放到到var中
        const expressionNum = Number(expression);
        if (!isNaN(expressionNum)) {
          vars[name] = expressionNum;
          delete formulas[name];
        }
      }
    }

    const replace: ObjectOf<string> = {};
    const extractReplace = (obj: Formulas) => {
      for (const aname of Object.keys(obj)) {
        const expression = obj[aname];
        if (typeof expression === "string" && expression.split("#").length - 1 > 1) {
          // 含一个#的没问题
          replace[aname] = expression;
          delete obj[aname];
          continue;
        }
      }
    };
    extractReplace(formulas); // 取出公式里有##的
    extractReplace(vars); // 取出变量里有##的

    const ok: ObjectOf<string> = {};
    const okNumber: ObjectOf<string> = {};
    const errInfo: ObjectOf<string> = {};

    for (const name of sortedKeys) {
      if (!formulas[name]) {
        continue;
      }

      const expression = formulas[name].toString();
      const result = this.calcExpress(expression, vars);
      if (result.error !== null) {
        errInfo[name] = result.error;
        continue;
      }

      const num = Number(result.value);
      ok[name] = expression;
      okNumber[name] = `${name} = ${expression} = ${result.value}`;
      vars[name] = result.value;

      if (!isNaN(num) && num <= 0) {
        maybeError[name] = expression;
      }
    }

    // 算不下去了，提示算不出来的公式
    for (const name in formulas) {
      if (ok[name] === undefined) {
        error[name] = formulas[name].toString();
      }
    }

    // 处理需要替换的字符串，含##的表达式
    if (!isEmpty(replace)) {
      while (true) {
        const ok2: ObjectOf<string> = {};
        for (const key in replace) {
          let value = replace[key];
          const matches = value.match(/#(.*?)#/g);
          // (1)没有匹配到##
          if (!matches || matches.length < 1) {
            ok2[key] = value;
            vars[key] = value;
            continue;
          }

          const replaceTo = "*****";
          for (const match_v of matches) {
            const expressionK = trim(match_v, "#");
            let replaceV = "";

            if (vars[expressionK] !== undefined) {
              // 直接替换, 这种情况是选项，选项里可能有#
              if (typeof vars[expressionK] === "number") {
                replaceV = toFixed(vars[expressionK], 3);
              } else {
                replaceV = vars[expressionK].toString();
              }
              replaceV = replaceV.replaceAll("#", replaceTo);
            } else {
              // 尝试计算# #之间的内容
              const calcResult = this.calcExpress(expressionK, vars);
              const calcNumber = Number(calcResult.value);
              if (calcResult.error === null && !isNaN(calcNumber)) {
                // 算出来了
                replaceV = toFixed(calcNumber, 3); // 转数字
              } else {
                // 算不出来, 不能替换
                replaceV = match_v;
              }
            }

            value = value.replaceAll(match_v, replaceV);
          }

          // ##, 全部替换完了
          const replaceValue = value.replaceAll(replaceTo, "#");
          replace[key] = replaceValue;
          ok2[key] = replaceValue;
          vars[key] = replaceValue;
        }

        // 有替换掉的
        if (!isEmpty(ok2)) {
          for (const k in ok2) {
            delete replace[k];
          }
        }

        // 替换完了
        if (isEmpty(replace)) {
          break;
        }

        // 替换不下去了，提示替换不出来的表达式
        if (isEmpty(ok2) && !isEmpty(replace)) {
          for (const name in replace) {
            error[name] = replace[name];
          }
          break;
        }
      }
    }

    // * 筛选出根本计算不了的公式
    const errorTrim: ObjectOf<string> = {};
    for (const k in error) {
      for (const vv of sortedFormulas[k].vars) {
        if (error[vv] === undefined && vars[vv] === undefined) {
          errorTrim[k] = error[k];
        }
      }
    }

    const succeed = vars;
    const succeedTrim: Formulas = {};
    for (const key in succeed) {
      if (key in formulasRaw) {
        succeedTrim[key] = succeed[key];
      }
    }
    return {succeed, succeedTrim, error, errorTrim, maybeError, fulfilled: isEmpty(error)};
  }

  public static divide(numbers: number[], containers: number[], space?: number): number[] {
    if (typeof space === "number") {
      containers = containers.map((v) => v - space);
      return this.divide(numbers, containers);
    }
    const total = numbers.reduce((prev, curr) => prev + curr);
    return containers
      .map((container) => [container, Math.ceil(total / container)])
      .sort((a, b) => (a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]))[0];
  }
}

export type CalcResult = ReturnType<(typeof Calc)["calcFormulas"]>;

let inited = false;
const initCalc = () => {
  if (inited) {
    return;
  }
  const funcs = {
    round: (num: string | number, decimal = 0) => {
      if (typeof num === "number" && isNaN(num)) {
        return 0;
      }
      const res = toFixed(num, decimal);
      return Number(res);
    },
    ceil: Math.ceil,
    floor: Math.floor,
    in_array: (needle: any, stack: any[]) => stack.includes(needle),
    strpos: (str: string, needle: string) => {
      const index = str.indexOf(needle);
      if (index === -1) {
        return false;
      }
      return index;
    },
    sqrt: Math.sqrt,
    tan: Math.tan,
    atan: Math.atan,
    sin: Math.sin,
    asin: Math.asin,
    cos: Math.cos,
    acos: Math.acos,
    pi: Math.PI,
    有小数: (num: number) => num - Math.floor(num) !== 0,
    有整除余数: (num: number, num2: number) => num % num2 !== 0,
    是整数: (num: number) => num - Math.floor(num) === 0,
    是奇数: (num: number) => num % 2 !== 0,
    是偶数: (num: number) => num % 2 === 0,
    求整除余数: (num: number, num2: number) => num % num2,
    求小数: (num: number) => num - Math.floor(num),
    包含: (str1: any, str2: any) => {
      if (!str1 || !str2) {
        return false;
      }
      if (typeof str1 !== "string" || typeof str2 !== "string") {
        return false;
      }

      return str1.includes(str2);
    }
  };

  for (const name in funcs) {
    const func = (funcs as any)[name];
    Reflect.defineProperty(window, name, {value: func});
    Reflect.defineProperty(window, name.toUpperCase(), {value: func});
  }
  inited = true;
};
