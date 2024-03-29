import {ElementRef} from "@angular/core";
import {ViewChild, ViewChildren} from "@angular/core";
import {Component, Inject} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialogActions, MatDialogRef} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {Formulas} from "@app/utils/calc";
import {getOpenDialogFunc} from "@components/dialogs/dialog.common";
import {ZixuanpeijianMokuaiItem} from "@components/dialogs/zixuanpeijian/zixuanpeijian.types";
import {getMokuaiTitle} from "@components/dialogs/zixuanpeijian/zixuanpeijian.utils";
import {FormulaInfo} from "@components/formulas/formulas.component";
import {CadData, toFixedTrim} from "@lucilor/cad-viewer";
import {isTypeOf, ObjectOf, timeout} from "@lucilor/utils";
import {CalcService} from "@services/calc.service";
import {LastSuanliao} from "@views/suanliao/suanliao.types";
import csstype from "csstype";
import {NgScrollbar} from "ngx-scrollbar";
import {FormulasComponent} from "../../components/formulas/formulas.component";

@Component({
  selector: "app-xhmrmsbj-mokuais",
  templateUrl: "./xhmrmsbj-mokuais.component.html",
  styleUrls: ["./xhmrmsbj-mokuais.component.scss"],
  standalone: true,
  imports: [NgScrollbar, FormulasComponent, MatDividerModule, MatDialogActions, MatButtonModule]
})
export class XhmrmsbjMokuaisComponent {
  @ViewChildren("mkdxFormula", {read: ElementRef}) mkdxFormulaRef?: ElementRef<HTMLDivElement>[];
  mkdxFormulaInfos: XhmrmsbjMkdxFormulaInfo[] = [];
  xuanzhongMokuaiInfos: XhmrmsbjXuanzhongMokuaiInfo[] = [];
  getMokuaiTitle = getMokuaiTitle;
  formulaStyles: csstype.Properties = {fontSize: "18px"};
  @ViewChild("section1") section1?: ElementRef<HTMLDivElement>;

  constructor(
    public dialogRef: MatDialogRef<XhmrmsbjMokuaisComponent, XhmrmsbjMokuaisOutput>,
    @Inject(MAT_DIALOG_DATA) public data: XhmrmsbjMokuaisInput,
    private calc: CalcService
  ) {
    this.update();
  }

  async update() {
    this.mkdxFormulaInfos = [];
    this.xuanzhongMokuaiInfos = [];
    const {lastSuanliao, mokuaidaxiaoResults} = this.data.data;
    const {input, output} = lastSuanliao;
    for (const key of input.bujuNames) {
      const value = input.型号选中门扇布局[key];
      if (!value) {
        continue;
      }
      const mokuaidaxiaoResult = mokuaidaxiaoResults[key] || {};
      const mkdxFormulaInfos: XhmrmsbjMkdxFormulaInfo = {name: key, formulaInfos: []};
      const xuanzhongMokuaiInfo: XhmrmsbjXuanzhongMokuaiInfo = {name: key, nodes: []};
      for (const node of value.模块节点 || []) {
        const mokuai = node.选中模块;
        if (mokuai) {
          const mokuai2 = output.配件模块CAD.find((v) => {
            const {门扇名字, 模块名字} = v.info || {};
            return 门扇名字 === key && 模块名字 === node.层名字 && v.weiyima === mokuai.weiyima;
          });
          const cads: CadData[] = [];
          const suanliaogongshi = {...mokuai.suanliaogongshi};
          for (const [k, v] of [...mokuai.gongshishuru, ...mokuai.xuanxiangshuru]) {
            if (!isTypeOf(v, ["number", "string"])) {
              continue;
            }
            if (k in suanliaogongshi) {
              suanliaogongshi[k] = v;
            }
          }
          const formulas2 = {...output.materialResult};
          if (mokuai2) {
            Object.assign(formulas2, mokuai2.suanliaogongshi);
            for (const cadItem of mokuai2.cads) {
              cads.push(new CadData(cadItem.data));
              Object.assign(formulas2, cadItem.info.dimensionVars);
            }
            formulas2.门扇布局 = mokuai2.info?.门扇布局?.name || "";
          }
          Object.assign(formulas2, mokuaidaxiaoResult);
          for (const key2 of ["总宽", "总高"]) {
            const key3 = node.层名字 + key2;
            if (key3 in formulas2) {
              formulas2[key2] = formulas2[key3];
            }
          }
          xuanzhongMokuaiInfo.nodes.push({
            layer: node.层名字,
            mokuai,
            formulaInfos: this.getFormulaInfos(suanliaogongshi, formulas2)
          });
        }
      }
      mkdxFormulaInfos.formulaInfos = this.getFormulaInfos(mokuaidaxiaoResult);
      this.mkdxFormulaInfos.push(mkdxFormulaInfos);
      this.xuanzhongMokuaiInfos.push(xuanzhongMokuaiInfo);
    }
  }

  async updateSection1() {
    await timeout(0);
    const section1El = this.section1?.nativeElement;
    if (section1El) {
      const containerEl = section1El.querySelector(".flex-column");
      if (containerEl) {
        const {width} = containerEl.getBoundingClientRect();
        section1El.style.width = width + "px";
      }
    }
  }

  getFormulaInfos(formulas: Formulas, formulas2?: Formulas) {
    const infos: FormulaInfo[] = [];
    const getValues = (val: string | number) => {
      const values: FormulaInfo["values"] = [];
      if (typeof val === "number") {
        values.push({eq: true, name: toFixedTrim(val, 2)});
      } else if (typeof val === "string") {
        val = val.trim();
        values.push({eq: true, name: val});
        const val2 = this.calc.calc.replaceVars(val, formulas2);
        if (val !== val2) {
          values.push({eq: true, name: val2});
        }
      }
      return values;
    };
    for (const [key, value] of Object.entries(formulas)) {
      const keys: FormulaInfo["keys"] = [{eq: true, name: key}];
      const values: FormulaInfo["values"] = getValues(value);
      if (formulas2 && key in formulas2) {
        const valuePrev = values.at(-1)?.name;
        const value2 = getValues(formulas2[key]).filter((v) => v.name !== valuePrev);
        if (value2.length > 0) {
          const valueNext = value2[0].name;
          let calcResult = this.calc.calc.calcExpress(`(${valuePrev}) === (${valueNext})`);
          if (calcResult.value !== true) {
            calcResult = this.calc.calc.calcExpress(`(\`${valuePrev}\`) === (\`${valueNext}\`)`);
          }
          if (calcResult.value !== true) {
            calcResult = this.calc.calc.calcExpress(`(eval(\`${valuePrev}\`)) === (\`${valueNext}\`)`);
          }
          value2[0].eq = calcResult.value === true;
          values.push(...value2);
        }
      }
      infos.push({keys, values});
    }
    return infos;
  }

  close() {
    this.dialogRef.close();
  }
}

export interface XhmrmsbjMokuaisInput {
  data: {lastSuanliao: LastSuanliao; mokuaidaxiaoResults: ObjectOf<Formulas>};
}

export type XhmrmsbjMokuaisOutput = void;

export const openXhmrmsbjMokuaisDialog = getOpenDialogFunc<XhmrmsbjMokuaisComponent, XhmrmsbjMokuaisInput, XhmrmsbjMokuaisOutput>(
  XhmrmsbjMokuaisComponent,
  {width: "100%", height: "100%"}
);

export interface XhmrmsbjMkdxFormulaInfo {
  name: string;
  formulaInfos: FormulaInfo[];
}

export interface XhmrmsbjXuanzhongMokuaiInfo {
  name: string;
  nodes: {
    layer: string;
    mokuai: ZixuanpeijianMokuaiItem;
    formulaInfos: FormulaInfo[];
  }[];
}
