import {KeyValue, KeyValuePipe} from "@angular/common";
import {Component, HostBinding, Inject, OnInit} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {getCopyName, timer} from "@app/app.common";
import {CadImageComponent} from "@components/cad-image/cad-image.component";
import {getOpenDialogFunc} from "@components/dialogs/dialog.common";
import {openEditFormulasDialog} from "@components/dialogs/edit-formulas-dialog/edit-formulas-dialog.component";
import {downloadByString, selectFiles, timeout} from "@lucilor/utils";
import {SuanliaogongshiComponent} from "@modules/cad-editor/components/suanliaogongshi/suanliaogongshi.component";
import {SuanliaogongshiInfo} from "@modules/cad-editor/components/suanliaogongshi/suanliaogongshi.types";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerService} from "@modules/spinner/services/spinner.service";
import {CalcService} from "@services/calc.service";
import {cloneDeep, uniqueId} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import printJS from "print-js";
import {BehaviorSubject, filter, take} from "rxjs";
import {getSuanliaoDataSearch} from "../suanliao-tables/suanliao-tables.utils";
import {测试用例} from "../xinghao-data";
import {SuanliaoTestInfo, SuanliaoTestInput, SuanliaoTestOutput} from "./suanliao-test-dialog.types";
import {calcTestCase, getTestCaseInfo} from "./suanliao-test-dialog.utils";

@Component({
  selector: "app-suanliao-test-dialog",
  standalone: true,
  imports: [
    CadImageComponent,
    InputComponent,
    KeyValuePipe,
    MatButtonModule,
    MatDividerModule,
    NgScrollbarModule,
    SuanliaogongshiComponent
  ],
  templateUrl: "./suanliao-test-dialog.component.html",
  styleUrl: "./suanliao-test-dialog.component.scss"
})
export class SuanliaoTestDialogComponent implements OnInit {
  @HostBinding("class") class = ["ng-page"];

  infos: SuanliaoTestInfo[] = [];
  allSlgsInfo: SuanliaogongshiInfo | null = null;
  printing: {teseCaseIndex?: number} | null = null;
  cadImgsCount$ = new BehaviorSubject<number>(0);
  printElId = uniqueId("printEl");

  constructor(
    private dialog: MatDialog,
    private message: MessageService,
    private calc: CalcService,
    private spinner: SpinnerService,
    private http: CadDataService,
    public dialogRef: MatDialogRef<SuanliaoTestDialogComponent, SuanliaoTestOutput>,
    @Inject(MAT_DIALOG_DATA) public data: SuanliaoTestInput
  ) {}

  ngOnInit() {
    this.updateInfo();
  }

  async updateInfo() {
    const {测试用例} = this.data.data;
    this.infos = [];
    for (const testCase of 测试用例) {
      const info = await getTestCaseInfo(testCase, this.data.data, this.calc);
      this.infos.push(info);
    }
  }

  async getTestCaseItem(data0?: 测试用例) {
    const data: 测试用例 = {名字: "", 时间: 0, 测试数据: {}, 测试正确: false, ...data0};
    const result = await openEditFormulasDialog(this.dialog, {
      data: {
        formulas: data.测试数据,
        extraInputInfos: [
          {type: "string", label: "名字", model: {data, key: "名字"}, validators: Validators.required},
          {type: "boolean", label: "测试正确", model: {data, key: "测试正确"}}
        ]
      }
    });
    if (result) {
      data.测试数据 = result;
      data.时间 = Date.now();
      return data;
    }
    return null;
  }

  getTestCaseSearch(testCase: 测试用例) {
    const where = getSuanliaoDataSearch(this.data.suanliaoDataParams);
    where.名字 = testCase.名字;
    return where;
  }

  async addTestCase() {
    const data = this.data.data;
    if (!data.测试用例) {
      return;
    }
    const result = await this.getTestCaseItem();
    if (result) {
      data.测试用例.push(result);
      await this.updateInfo();
    }
  }

  async editTestCase(index: number) {
    const data = this.data.data;
    if (!data.测试用例) {
      return;
    }
    const result = await this.getTestCaseItem(data.测试用例[index]);
    if (result) {
      if (data.测试用例[index].名字 !== result.名字) {
        const where = this.getTestCaseSearch(data.测试用例[index]);
        const success = await this.http.updateMongodb({collection: "suanliaoceshishuju", data: {名字: result.名字}, where});
        if (!success) {
          return;
        }
      }
      data.测试用例[index] = result;
      await this.updateInfo();
    }
  }

  async copyTestCase(index: number) {
    const data = this.data.data;
    if (!data.测试用例) {
      return;
    }
    if (!(await this.message.confirm(`确定复制【${data.测试用例[index].名字}】吗？`))) {
      return;
    }
    const item = cloneDeep(data.测试用例[index]);
    const names = data.测试用例.map((v) => v.名字);
    item.名字 = getCopyName(names, item.名字);
    item.时间 = Date.now();
    data.测试用例.push(item);
    await this.updateInfo();
  }

  async removeTestCase(index: number) {
    const data = this.data.data;
    if (!data.测试用例) {
      return;
    }
    if (!(await this.message.confirm(`确定删除【${data.测试用例[index].名字}】吗？`))) {
      return;
    }
    const where = this.getTestCaseSearch(data.测试用例[index]);
    const success = await this.http.deleteMongodb({collection: "suanliaoceshishuju", where});
    if (!success) {
      return;
    }
    data.测试用例.splice(index, 1);
    await this.updateInfo();
  }

  async importTestCases() {
    const data = this.data.data;
    if (!(await this.message.confirm("确定导入吗？"))) {
      return;
    }
    const files = await selectFiles({accept: ".json"});
    const file = files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      let data2: any;
      try {
        data2 = JSON.parse(reader.result as string);
      } catch {}
      if (Array.isArray(data2)) {
        data.测试用例.push(...data2);
        this.updateInfo();
      } else {
        this.message.error("测试用例数据有误");
      }
    });
    reader.readAsText(file);
  }

  exportTestCases() {
    const data = this.data.data;
    downloadByString(JSON.stringify(data.测试用例), {filename: "测试用例.json"});
  }

  async calcTestCases() {
    const errors: string[] = [];
    this.spinner.show(this.spinner.defaultLoaderId, {text: "正在测试所有算料"});
    timer.start("测试所有算料");
    for (const [i] of this.data.data.测试用例.entries()) {
      const result = await this.calcTestCase(i);
      if (result.errors.length > 0) {
        errors.push(...result.errors);
      }
    }
    if (errors.length > 0) {
      this.message.error(errors.join("<br/>"));
    }
    this.spinner.hide(this.spinner.defaultLoaderId);
    timer.end("测试所有算料", "测试所有算料");
  }

  getTimeStr(time: number) {
    return new Date(time).toLocaleString();
  }

  submit() {
    this.dialogRef.close({});
  }

  returnZero() {
    return 0;
  }

  getGongshiStr(item: KeyValue<string, string | number>) {
    return `${item.key} = ${item.value}`;
  }

  toggleSlgsAll() {
    if (this.allSlgsInfo) {
      this.allSlgsInfo = null;
    } else {
      this.allSlgsInfo = {data: {算料公式: this.data.data.算料公式}};
    }
  }

  async onSlgsChange() {
    await this.updateInfo();
  }

  async calcTestCase(i: number) {
    const testCase = this.data.data.测试用例[i];
    const info = this.infos[i];
    const result = await calcTestCase(testCase, info, this.data.data, this.dialog, this.message, this.calc);
    const data = {
      名字: testCase.名字,
      数据: {
        需要提供的测试值: info.requiredVars,
        算料结果: result.calcResult?.succeed,
        算料CAD: info.cads
      }
    };
    const where = this.getTestCaseSearch(testCase);
    await this.http.updateMongodb({collection: "suanliaoceshishuju", data, where, upsert: true});
    return result;
  }

  async calcTestCaseI(i: number) {
    this.spinner.show(this.spinner.defaultLoaderId, {text: "正在测试算料"});
    timer.start("测试算料");
    const result = await this.calcTestCase(i);
    this.spinner.hide(this.spinner.defaultLoaderId);
    timer.end("测试算料", "测试算料");
    if (result.errors.length > 0) {
      this.message.error(result.errors.join("<br/>"));
      return;
    }
    return result;
  }

  async print(teseCaseIndex?: number) {
    this.printing = {teseCaseIndex};
    this.class = [...this.class, "printing"];
    this.cadImgsCount$.next(0);
    let imgsTotal = this.data.data.算料CAD.length;
    if (typeof teseCaseIndex !== "number") {
      imgsTotal *= this.data.data.测试用例.length;
    }
    await new Promise<void>((resolve) => {
      this.cadImgsCount$
        .pipe(
          filter((v) => v === imgsTotal),
          take(1)
        )
        .subscribe(() => {
          resolve();
        });
    });
    await timeout(0);

    printJS({printable: this.printElId, type: "html", targetStyles: ["*"]});
    this.printing = null;
    this.class = this.class.filter((v) => v !== "printing");
  }

  getTestCaseInput(i: number) {
    const testCase = this.data.data.测试用例[i];
    const info: InputInfo<测试用例> = {
      type: "boolean",
      label: "测试通过",
      model: {data: testCase, key: "测试正确"}
    };
    return info;
  }

  onCadImgEnd() {
    this.cadImgsCount$.next(this.cadImgsCount$.value + 1);
  }
}

export const openSuanliaoTestDialog = getOpenDialogFunc<SuanliaoTestDialogComponent, SuanliaoTestInput, SuanliaoTestOutput>(
  SuanliaoTestDialogComponent,
  {width: "100%", height: "100%"}
);
