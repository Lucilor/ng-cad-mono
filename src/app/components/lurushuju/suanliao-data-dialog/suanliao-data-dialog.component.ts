import {
  Component,
  effect,
  ElementRef,
  EventEmitter,
  HostBinding,
  Inject,
  OnInit,
  Output,
  QueryList,
  signal,
  ViewChild,
  ViewChildren
} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatIconModule} from "@angular/material/icon";
import {session} from "@app/app.common";
import {filterCad} from "@app/cad/cad-shujuyaoqiu";
import {HoutaiCad} from "@app/modules/http/services/cad-data.service.types";
import {OpenCadOptions} from "@app/services/app-status.types";
import {getOpenDialogFunc} from "@components/dialogs/dialog.common";
import {openZixuanpeijianDialog} from "@components/dialogs/zixuanpeijian/zixuanpeijian.component";
import {ZixuanpeijianInput} from "@components/dialogs/zixuanpeijian/zixuanpeijian.types";
import {CadData} from "@lucilor/cad-viewer";
import {ObjectOf, RequiredKeys, timeout} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {getHoutaiCad} from "@modules/http/services/cad-data.service.utils";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo} from "@modules/input/components/input.types";
import {MessageService} from "@modules/message/services/message.service";
import {SpinnerService} from "@modules/spinner/services/spinner.service";
import {TableComponent} from "@modules/table/components/table/table.component";
import {AppStatusService} from "@services/app-status.service";
import {debounce} from "lodash";
import {NgScrollbar, NgScrollbarModule} from "ngx-scrollbar";
import {SuanliaogongshiComponent} from "../../../modules/cad-editor/components/suanliaogongshi/suanliaogongshi.component";
import {CadItemComponent} from "../cad-item/cad-item.component";
import {CadItemButton} from "../cad-item/cad-item.types";
import {openSelectGongyiDialog} from "../select-gongyi-dialog/select-gongyi-dialog.component";
import {SelectGongyiItemData} from "../select-gongyi-dialog/select-gongyi-dialog.types";
import {SuanliaoTablesComponent} from "../suanliao-tables/suanliao-tables.component";
import {openSuanliaoTestDialog} from "../suanliao-test-dialog/suanliao-test-dialog.component";
import {SuanliaoDataParams, 算料数据} from "../xinghao-data";
import {SuanliaoDataCadItemInfo, SuanliaoDataInput, SuanliaoDataOutput} from "./suanliao-data-dialog.type";

@Component({
  selector: "app-suanliao-data-dialog",
  standalone: true,
  imports: [
    CadItemComponent,
    InputComponent,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    NgScrollbarModule,
    SuanliaogongshiComponent,
    SuanliaoTablesComponent,
    TableComponent
  ],
  templateUrl: "./suanliao-data-dialog.component.html",
  styleUrl: "./suanliao-data-dialog.component.scss"
})
export class SuanliaoDataDialogComponent implements OnInit {
  @HostBinding("class") class = "ng-page";
  @Output() cadFormSubmitted = new EventEmitter<void>();

  cadItemButtons: CadItemButton<SuanliaoDataCadItemInfo>[];
  mubanExtraData: CadItemComponent["mubanExtraData"] = {};
  openCadOptions: RequiredKeys<OpenCadOptions, "suanliaogongshiInfo">;
  suanliaoCadsSearch: InputInfo;
  hiddenSuanliaoCads: number[] = [];
  isSuanliaoCadReversed = true;
  cadNameValidator = ((data: CadData) => {
    const names = this.data.data.算料CAD.map((v) => v.名字);
    if (names.filter((v) => v === data.name).length > 1) {
      return {名字重复: true};
    }
    return null;
  }).bind(this);

  showMenuLeftKey = "suanliaoDataDialog.showMenuLeft";
  showMenuRightKey = "suanliaoDataDialog.showMenuRight";
  showMenuLeft = signal(session.load<boolean>(this.showMenuLeftKey) ?? true);
  showMenuRight = signal(session.load<boolean>(this.showMenuRightKey) ?? true);

  @ViewChild(SuanliaoTablesComponent) suanliaoTables?: SuanliaoTablesComponent;
  @ViewChildren(CadItemComponent) cadItems?: QueryList<CadItemComponent>;
  @ViewChild("cadsScrollbar") cadsScrollbar?: NgScrollbar;

  constructor(
    private message: MessageService,
    private dialog: MatDialog,
    private http: CadDataService,
    private spinner: SpinnerService,
    private status: AppStatusService,
    private el: ElementRef<HTMLElement>,
    public dialogRef: MatDialogRef<SuanliaoDataDialogComponent, SuanliaoDataOutput>,
    @Inject(MAT_DIALOG_DATA) public data: SuanliaoDataInput
  ) {
    this.mubanExtraData.options = this.data.suanliaoDataParams.选项;
    this.openCadOptions = {
      suanliaogongshiInfo: {
        data: {
          算料公式: this.data.data.算料公式,
          输入数据: this.data.data.输入数据
        },
        varNames: this.data.varNames
      },
      suanliaoTablesInfo: {params: this.data.suanliaoDataParams}
    };
    this.cadItemButtons = [
      {name: "复制", onClick: this.copyCad.bind(this)},
      {name: "删除", onClick: this.removeCad.bind(this)}
    ];
    if (this.data.isKailiao) {
      this.cadItemButtons.push(
        ...[
          {name: "添加孔位配置", onClick: this.addKwpz.bind(this)},
          {name: "添加开料参数", onClick: this.addKlcs.bind(this)}
        ]
      );
    }
    this.suanliaoCadsSearch = {
      type: "string",
      label: "搜索",
      onInput: debounce((val) => {
        this.hiddenSuanliaoCads = [];
        for (const [i, cad] of this.data.data.算料CAD.entries()) {
          const yaoqiu = this.status.getCad数据要求(cad.分类);
          if (yaoqiu && !filterCad(val, cad, yaoqiu)) {
            this.hiddenSuanliaoCads.push(i);
          }
        }
      }, 500)
    };

    effect(() => {
      session.save(this.showMenuLeftKey, this.showMenuLeft());
    });
    effect(() => {
      session.save(this.showMenuRightKey, this.showMenuRight());
    });
  }

  ngOnInit() {
    if (this.data.suanliaoTestName) {
      this.suanliaoTest();
    }
  }

  returnZero() {
    return 0;
  }

  getCadYaoqiu(cad: HoutaiCad) {
    return this.status.getCad数据要求(cad.分类);
  }

  async selectSuanliaoCads() {
    const {data} = this.data;
    const zxpjData: ZixuanpeijianInput = {
      data: {
        零散: data.算料CAD.map((v) => {
          const cad = new CadData(v.json);
          cad.info.isSuanliaoSelected = true;
          return {data: cad, info: {houtaiId: v._id, zhankai: [], calcZhankai: []}};
        })
      },
      step: 3,
      stepFixed: true,
      noValidateCads: true,
      gongshis: data.算料公式
    };
    const result = await openZixuanpeijianDialog(this.dialog, {data: zxpjData});
    if (result) {
      data.算料CAD = result.零散.map((v) => {
        return getHoutaiCad(v.data, {houtaiId: v.info.houtaiId});
      });
    }
  }

  async copySuanliaoCads() {
    const {componentLrsj, key1} = this.data;
    if (!componentLrsj) {
      return;
    }
    const result = await openSelectGongyiDialog(this.dialog, {
      data: {
        xinghaoMenchuangs: componentLrsj.xinghaoMenchuangs,
        xinghaoOptions: componentLrsj.xinghaoOptionsAll,
        menjiaoOptions: componentLrsj.menjiaoOptionsAll,
        key: "算料数据",
        fenlei: componentLrsj.fenleiName
      }
    });
    const data = result?.items[0] as SelectGongyiItemData<算料数据>;
    if (!data?.工艺做法 || !data.data) {
      return;
    }
    const {suanliaoTables} = this;
    const [包边方向, 开启] = key1.split("+");
    const suanliaoDataParams: SuanliaoDataParams = {
      选项: {
        型号: data.型号,
        产品分类: data.产品分类,
        工艺做法: data.工艺做法,
        包边方向,
        开启,
        门铰锁边铰边: data.data.名字
      }
    };
    const suanliaoDataParams2 = this.data.suanliaoDataParams;
    for (const cad of data.data[key1].算料CAD) {
      const zhankai = cad.json.zhankai?.[0];
      if (!zhankai) {
        continue;
      }
      let zhankaiKey: string | undefined;
      let mubanId: string | undefined;
      const zhankaiKeys = ["neikaimuban", "kailiaomuban"];
      for (const key of zhankaiKeys) {
        if (zhankai[key]) {
          zhankaiKey = key;
          mubanId = zhankai[key];
          break;
        }
      }
      if (!zhankaiKey || !mubanId) {
        continue;
      }
      if (mubanId) {
        const ids = await this.http.mongodbCopy("kailiaocadmuban", mubanId, {extraData: suanliaoDataParams2, force: true}, {silent: true});
        if (ids?.[0]) {
          zhankai[zhankaiKey] = ids[0];
        } else {
          for (const key of zhankaiKeys) {
            delete zhankai[key];
          }
        }
      }
    }
    this.data.data.算料CAD.push(...data.data[key1].算料CAD);
    this.data.data.算料公式.push(...data.data[key1].算料公式);
    if (suanliaoTables) {
      this.spinner.show(this.spinner.defaultLoaderId);
      const klkwpzData = await suanliaoTables.getKlkwpzData(suanliaoDataParams);
      const klcsData = await suanliaoTables.getKlcsTableData(suanliaoDataParams);
      await this.http.mongodbInsertMulti(
        suanliaoTables.klkwpzCollection,
        klkwpzData.map((v) => ({名字: v.名字, 孔位配置: v.孔位配置})),
        {extraData: suanliaoDataParams2},
        {silent: true}
      );
      await this.http.mongodbInsertMulti(
        suanliaoTables.klcsCollection,
        klcsData.map((v) => ({名字: v.名字, 参数: v.参数})),
        {extraData: suanliaoDataParams2},
        {silent: true}
      );
      await suanliaoTables.update();
      this.spinner.hide(this.spinner.defaultLoaderId);
    }
  }

  async suanliaoTest() {
    const {componentLrsj: component, varNames, suanliaoDataParams} = this.data;
    if (!component) {
      return;
    }
    component.suanliaoTestName = "true";
    component.saveInfo();
    await openSuanliaoTestDialog(this.dialog, {data: {data: this.data.data, varNames, suanliaoDataParams}});
    component.suanliaoTestName = "";
    component.saveInfo();
  }

  async validate() {
    const cadItems = this.cadItems?.toArray() || [];
    const errors: string[] = [];
    for (const item of cadItems) {
      for (const err of item.validate()) {
        if (!errors.includes(err)) {
          errors.push(err);
        }
      }
    }

    await timeout(0);
    const targetY = window.innerHeight / 2;
    const errorElInfos: {el: HTMLElement; y: number; order: number}[] = [];
    this.el.nativeElement.querySelectorAll<HTMLElement>(".error, .name-error").forEach((el) => {
      const {top, bottom} = el.getBoundingClientRect();
      errorElInfos.push({el, y: (top + bottom) / 2, order: Math.abs((top + bottom) / 2 - targetY)});
    });
    errorElInfos.sort((a, b) => a.order - b.order);
    const {cadsScrollbar: scrollbar} = this;
    if (errorElInfos.length > 0 && scrollbar) {
      const dy = errorElInfos[0].y - targetY;
      if (dy !== 0) {
        scrollbar.scrollTo({top: scrollbar.nativeElement.scrollTop + dy});
      }
    }

    if (errors.length > 0) {
      this.message.error(errors.join("<br>"));
    }
    return errors;
  }

  async submit() {
    const errors = await this.validate();
    if (errors.length < 1) {
      this.dialogRef.close({data: this.data.data});
    }
  }

  async copyCad(component: CadItemComponent<SuanliaoDataCadItemInfo>) {
    const {cad, cadName} = component;
    if (!(await this.message.confirm(`确定复制【${cadName}】吗？`))) {
      return;
    }
    const {mubanData} = component;
    const cadData2 = (cad instanceof CadData ? cad : new CadData(cad.json)).clone(true);
    delete cadData2.info.imgId;
    cadData2.name += "_复制";
    const cad2 = getHoutaiCad(cadData2);
    if (mubanData) {
      const cadData = new CadData(mubanData.clone(true));
      const result = await this.http.setCad({collection: "kailiaocadmuban", cadData, force: true}, true);
      if (!result) {
        return;
      }
      component.mubanId = result.id;
      component.mubanData = cadData;
    }
    this.data.data.算料CAD.splice(component.customInfo.index + 1, 0, cad2);
  }

  async removeCad(component: CadItemComponent<SuanliaoDataCadItemInfo>) {
    const {cadName, mubanId} = component;
    if (!(await this.message.confirm(`删除【${cadName}】将同时删除对应的孔位配置、开料参数、开料模板，确定删除吗？`))) {
      return;
    }
    if (mubanId) {
      await this.http.mongodbDelete("kailiaocadmuban", {id: mubanId});
    }
    const names = this.data.data.算料CAD.filter((v) => v.名字 === cadName);
    if (names.length < 2) {
      const params: ObjectOf<any> = this.data.suanliaoDataParams;
      await this.http.mongodbDelete("kailiaokongweipeizhi", {filter: {...params, 名字: cadName}});
      await this.http.mongodbDelete("kailiaocanshu", {filter: {...params, 名字: cadName + "中空参数"}});
      this.suanliaoTables?.update();
    }
    this.data.data.算料CAD.splice(component.customInfo.index, 1);
  }

  async addKwpz(component: CadItemComponent<SuanliaoDataCadItemInfo>) {
    const {suanliaoTables} = this;
    if (!suanliaoTables) {
      return;
    }
    const id = await this.http.mongodbInsert(suanliaoTables.klkwpzCollection, {...this.data.suanliaoDataParams, 名字: component.cadName});
    if (id) {
      suanliaoTables.updateKlkwpzTable();
    }
  }

  async addKlcs(component: CadItemComponent<SuanliaoDataCadItemInfo>) {
    const {suanliaoTables} = this;
    if (!suanliaoTables) {
      return;
    }
    const response = await this.http.mongodbInsert(suanliaoTables.klcsCollection, {
      ...this.data.suanliaoDataParams,
      名字: component.cadName + "中空参数",
      分类: "切中空"
    });
    if (response) {
      suanliaoTables.updateKlcsTable();
    }
  }

  async editBcfz() {
    const {componentMenjiao, key1} = this.data;
    if (!componentMenjiao) {
      return;
    }
    await componentMenjiao.editBcfz(key1);
  }

  async submitMenjiao() {
    const errors = await this.validate();
    if (errors.length > 0) {
      return;
    }
    const {componentMenjiao} = this.data;
    if (!componentMenjiao) {
      return;
    }
    componentMenjiao.submit(false);
  }

  getSuanliaoCads() {
    const cads = [...this.data.data.算料CAD];
    if (this.isSuanliaoCadReversed) {
      cads.reverse();
    }
    return cads;
  }

  getSuanliaoCadIndex(index: number) {
    return this.isSuanliaoCadReversed ? this.data.data.算料CAD.length - index - 1 : index;
  }
}

export const openSuanliaoDataDialog = getOpenDialogFunc<SuanliaoDataDialogComponent, SuanliaoDataInput, SuanliaoDataOutput>(
  SuanliaoDataDialogComponent,
  {width: "100%", height: "100%"}
);
