import {NgTemplateOutlet} from "@angular/common";
import {Component, ElementRef, HostBinding, Inject, OnInit, QueryList, ViewChild, ViewChildren} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MAT_DIALOG_DATA, MatDialog, MatDialogRef} from "@angular/material/dialog";
import {MatDividerModule} from "@angular/material/divider";
import {MatTabChangeEvent, MatTabsModule} from "@angular/material/tabs";
import {session, setGlobal} from "@app/app.common";
import {filterCad, setCadData} from "@app/cad/cad-shujuyaoqiu";
import {convertOptions} from "@app/modules/input/components/input.utils";
import {AppStatusService} from "@app/services/app-status.service";
import {openCadListDialog} from "@components/dialogs/cad-list/cad-list.component";
import {getOpenDialogFunc} from "@components/dialogs/dialog.common";
import {MrbcjfzDialogInput, openMrbcjfzDialog} from "@components/dialogs/mrbcjfz-dialog/mrbcjfz-dialog.component";
import {environment} from "@env";
import {CadData, CadViewerConfig} from "@lucilor/cad-viewer";
import {keysOf, ObjectOf} from "@lucilor/utils";
import {SuanliaogongshiInfo} from "@modules/cad-editor/components/suanliaogongshi/suanliaogongshi.types";
import {TypedTemplateDirective} from "@modules/directives/typed-template.directive";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {HoutaiCad} from "@modules/http/services/cad-data.service.types";
import {getHoutaiCad} from "@modules/http/services/cad-data.service.utils";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo, InputInfoSelect} from "@modules/input/components/input.types";
import {validateForm} from "@modules/message/components/message/message.utils";
import {MessageService} from "@modules/message/services/message.service";
import csstype from "csstype";
import {cloneDeep, debounce, isEmpty} from "lodash";
import {NgScrollbar, NgScrollbarModule} from "ngx-scrollbar";
import {CadItemComponent} from "../cad-item/cad-item.component";
import {CadItemButton} from "../cad-item/cad-item.types";
import {getOptionInputInfo} from "../lurushuju-index/lurushuju-index.utils";
import {openSuanliaoDataDialog} from "../suanliao-data-dialog/suanliao-data-dialog.component";
import {SuanliaoTablesComponent} from "../suanliao-tables/suanliao-tables.component";
import {
  get算料数据,
  MenjiaoCadType,
  menjiaoCadTypes,
  SuanliaoDataParams,
  xiaoguotuKeys,
  企料组合,
  孔位CAD名字对应关系,
  算料数据,
  算料数据2Keys,
  配合框组合,
  门缝配置,
  门缝配置输入
} from "../xinghao-data";
import {MenjiaoCadItemInfo, MenjiaoInput, MenjiaoOutput, MenjiaoShiyituCadItemInfo} from "./menjiao-dialog.types";
import {
  autoFillMenjiao,
  copySuanliaoData,
  getCadSearch,
  getMenjiaoCadInfos,
  getShiyituCadSearch,
  updateMenjiaoData
} from "./menjiao-dialog.utils";

@Component({
  selector: "app-menjiao-dialog",
  standalone: true,
  imports: [
    CadItemComponent,
    InputComponent,
    MatButtonModule,
    MatDividerModule,
    MatTabsModule,
    NgScrollbarModule,
    NgTemplateOutlet,
    SuanliaoTablesComponent,
    TypedTemplateDirective
  ],
  templateUrl: "./menjiao-dialog.component.html",
  styleUrl: "./menjiao-dialog.component.scss"
})
export class MenjiaoDialogComponent implements OnInit {
  @HostBinding("class") class = "ng-page";

  cadViewerConfig: Partial<CadViewerConfig> = {width: 200, height: 100, lineGongshi: 20};
  formData = get算料数据();
  menjiaoCadTypes = menjiaoCadTypes;
  peiheKeys = 配合框组合;
  qiliaoKeys = 企料组合;
  cadWidth = 300;
  cadHeight = 150;
  production = environment.production;
  cadItemButtons: CadItemButton<MenjiaoCadItemInfo>[];
  cadItemButtons2: CadItemButton<MenjiaoCadItemInfo>[];
  shiyituCadItemButtons: CadItemButton<MenjiaoShiyituCadItemInfo>[];
  emptyCadTemplateType!: {key1: MenjiaoCadType; key2: "配合框CAD" | "企料CAD"; key3: string};
  key1Infos: ObjectOf<{
    xiaoguotuInputs: InputInfo[];
    error: string;
    suanliaoDataParams: SuanliaoDataParams;
    suanliaogongshiInfo: SuanliaogongshiInfo;
    isLoaded: boolean;
    inputs: InputInfo[];
  }> = {};
  currKey1: MenjiaoCadType = menjiaoCadTypes[0];
  cadNameMap = 孔位CAD名字对应关系;
  menjiaoTabGroupIndex = 0;
  showSidebarKey = "menjiaoDialogShowSidebar";
  showSidebar = session.load<boolean>(this.showSidebarKey);

  form: InputInfo[] = [];
  shiyituSearchInputInfo: ObjectOf<InputInfo> = {};
  hiddenShiyitus: number[] = [];
  errors = {bcfz: false, others: false};
  @ViewChildren(InputComponent) inputs?: QueryList<InputComponent>;
  @ViewChildren(SuanliaoTablesComponent) suanliaoTablesList?: QueryList<SuanliaoTablesComponent>;
  @ViewChild("inputScrollbar") inputScrollbar?: NgScrollbar;

  constructor(
    private message: MessageService,
    private dialog: MatDialog,
    private http: CadDataService,
    private status: AppStatusService,
    private el: ElementRef<HTMLElement>,
    public dialogRef: MatDialogRef<MenjiaoDialogComponent, MenjiaoOutput>,
    @Inject(MAT_DIALOG_DATA) public data: MenjiaoInput
  ) {
    setGlobal("menjiaoDialog", this);
    if (!this.data) {
      this.data = {};
    }
    this.cadItemButtons = [{name: "删除", onClick: this.removeCad.bind(this)}];
    this.cadItemButtons2 = [{name: "选择", onClick: this.selectCad.bind(this)}];
    if (this.data.isKailiao) {
      this.cadItemButtons.push(
        ...[
          {name: "添加孔位配置", onClick: this.addKwpz.bind(this)},
          {name: "添加开料参数", onClick: this.addKlcs.bind(this)}
        ]
      );
    }
    this.shiyituCadItemButtons = [
      {name: "选择", onClick: this.selectShiyituCad.bind(this)},
      {name: "删除", onClick: this.removeShiyituCad.bind(this)}
    ];
    for (const type of menjiaoCadTypes) {
      this.shiyituSearchInputInfo[type] = {
        type: "string",
        label: "搜索",
        onInput: debounce((val) => {
          this.hiddenShiyitus = [];
          const yaoqiu = this.status.getCad数据要求("算料单示意图");
          if (yaoqiu) {
            for (const [i, cad] of this.formData[type].示意图CAD.算料单示意图.entries()) {
              if (!filterCad(val, cad, yaoqiu)) {
                this.hiddenShiyitus.push(i);
              }
            }
          }
        }, 500)
      };
    }
  }

  async ngOnInit() {
    await this.update();
    await this.validate();

    const suanliaoDataName = this.data.suanliaoDataName as MenjiaoCadType;
    if (menjiaoCadTypes.includes(suanliaoDataName)) {
      this.editSuanliaoData(suanliaoDataName);
    }
  }

  async update(useFormData?: boolean) {
    const {data: data0, componentLrsj} = this.data;
    if (!componentLrsj) {
      return;
    }
    if (!useFormData) {
      this.formData = data0 ? cloneDeep(data0) : get算料数据();
    }
    const data = this.formData;
    const 产品分类 = data0 ? data0.产品分类 : componentLrsj.fenleiName;
    data.产品分类 = 产品分类;
    updateMenjiaoData(data);
    const getGroupStyle = (style?: csstype.Properties): csstype.Properties => {
      return {display: "flex", flexWrap: "wrap", ...style};
    };
    const getInfoStyle = (n: number, style?: csstype.Properties): csstype.Properties => {
      const percent = 100 / n;
      const margin = 5;
      return {width: `calc(${percent}% - ${margin * 2}px)`, margin: `${margin}px`, ...style};
    };
    const getOptionInputInfo2 = (data: any, key: string, n: number): InputInfoSelect => {
      return getOptionInputInfo(componentLrsj.menjiaoOptionsAll, key, (info) => {
        info.model = {data, key};
        if (!info.readonly && !info.disabled) {
          info.validators = Validators.required;
        }
        info.onChange = () => {
          updateMenjiaoData(data);
        };
        info.style = getInfoStyle(n);
        const dialogKeys = ["门铰"];
        const openInNewTabKeys = ["门扇厚度"];
        if (dialogKeys.includes(key)) {
          info.optionsDialog = {
            noImage: true,
            defaultValue: {value: data.选项默认值[key] || "", required: true},
            optionKey: key,
            useLocalOptions: true,
            openInNewTab: true,
            onChange(val) {
              if (val.defaultValue) {
                data.选项默认值[key] = val.defaultValue;
              }
            }
          };
        } else if (openInNewTabKeys.includes(key)) {
          info.openInNewTab = {
            optionKey: key,
            onOptionsChange: (options) => {
              info.options = convertOptions(options.data);
            }
          };
        }
        if (key === "锁边") {
          info.hint = "请使用和实际对应的名字";
        }
      });
    };
    const getMenfengInputInfo = (value: (typeof 门缝配置输入)[number]): InputInfo => {
      return {
        type: "number",
        label: value.name,
        model: {data: data.门缝配置, key: value.name},
        validators: Validators.required,
        style: getInfoStyle(4)
      };
    };
    const optionKeys: (keyof 算料数据)[] = ["门铰", "门扇厚度", "锁边", "铰边"];
    const 使用双开门扇宽生成方式 = () => componentLrsj.fenleiName === "双开";
    const 锁扇蓝线宽比铰扇蓝线宽大 = (key1: MenjiaoCadType) => data[key1].双开门扇宽生成方式 === "锁扇蓝线宽比铰扇蓝线宽大";
    const form1Group2: InputInfo[] = [];
    const form1Group: InputInfo[] = [
      {
        type: "group",
        label: "",
        style: getInfoStyle(2),
        groupStyle: getGroupStyle({flexDirection: "column", height: "100%"}),
        infos: [
          {
            type: "group",
            label: "选项",
            infos: optionKeys.map((v) => getOptionInputInfo2(data, v, 2)),
            groupStyle: getGroupStyle()
          }
        ]
      },
      {
        type: "group",
        label: "",
        infos: form1Group2,
        style: getInfoStyle(2),
        groupStyle: getGroupStyle({flexDirection: "column"})
      }
    ];
    const 选项要求Form: InputInfo[] = [];
    for (const key in data.选项要求) {
      const value = data.选项要求[key];
      const info = getOptionInputInfo2(data, key, 4);
      选项要求Form.push(info);
      delete info.model;
      info.value = value.map((v) => v.mingzi);
      info.optionsDialog = {
        noImage: true,
        defaultValue: {value: value.find((v) => v.morenzhi)?.mingzi || ""},
        optionKey: key,
        useLocalOptions: true,
        openInNewTab: true,
        onChange(val) {
          data.选项要求[key] = cloneDeep(val.options);
          if (val.defaultValue) {
            for (const item of data.选项要求[key]) {
              if (item.mingzi === val.defaultValue) {
                item.morenzhi = true;
              }
            }
          }
        }
      };
    }
    const form1: InputInfo<typeof data>[] = [
      {
        type: "string",
        label: "名字",
        model: {data, key: "名字"},
        validators: [
          Validators.required,
          (control) => {
            const value = control.value;
            if (value === "无") {
              return {名字不能为无: true};
            }
            return null;
          }
        ],
        placeholder: "下单显示，请输入有意义的名字"
      },
      {
        type: "group",
        label: "",
        infos: form1Group,
        groupStyle: getGroupStyle()
      }
    ];
    if (选项要求Form.length > 0) {
      form1.push({
        type: "group",
        label: "选项要求",
        infos: 选项要求Form,
        groupStyle: getGroupStyle()
      });
    }
    const form2: InputInfo<门缝配置>[] = [
      {
        type: "group",
        label: "门缝配置",
        infos: 门缝配置输入.map(getMenfengInputInfo),
        style: {marginBottom: "5px"},
        groupStyle: getGroupStyle()
      }
    ];
    const form3: InputInfo[] = [
      {
        type: "group",
        label: "其他",
        infos: [
          {
            type: "boolean",
            label: "关闭碰撞检查",
            model: {data, key: "关闭碰撞检查"},
            style: getInfoStyle(2),
            validators: Validators.required
          }
        ],
        groupStyle: getGroupStyle()
      }
    ];
    form1Group2.push(...form2, ...form3);
    this.form = form1;

    this.key1Infos = {};

    for (const key1 of menjiaoCadTypes) {
      const [包边方向, 开启] = key1.split("+");
      const validators: InputInfo["validators"] = [
        (control) => {
          const menjiaoCadInfos = getMenjiaoCadInfos(data);
          if (menjiaoCadInfos[key1].isEmpty) {
            return null;
          }
          return Validators.required(control);
        }
      ];
      const setInputHidden = (info: InputInfo, hidden: boolean) => {
        info.hidden = hidden;
        if (hidden) {
          delete info.validators;
        } else {
          info.validators = validators;
        }
      };
      const inputs = [
        {
          ...getOptionInputInfo2(data[key1], "双开门扇宽生成方式", 1.5),
          onChange: () => {
            if (锁扇蓝线宽比铰扇蓝线宽大(key1)) {
              setInputHidden(inputs[1], false);
              if (!data[key1].锁扇铰扇蓝线宽固定差值) {
                data[key1].锁扇铰扇蓝线宽固定差值 = 0;
              }
            } else {
              setInputHidden(inputs[1], true);
              delete data[key1].锁扇铰扇蓝线宽固定差值;
            }
          }
        },
        {
          type: "number",
          label: "锁扇铰扇蓝线宽固定差值",
          model: {data: data[key1], key: "锁扇铰扇蓝线宽固定差值"},
          style: getInfoStyle(3)
        }
      ] as InputInfo<(typeof data)[typeof key1]>[];
      if (!使用双开门扇宽生成方式()) {
        setInputHidden(inputs[0], true);
        setInputHidden(inputs[1], true);
        data[key1].双开门扇宽生成方式 = "";
        delete data[key1].锁扇铰扇蓝线宽固定差值;
      } else if (!锁扇蓝线宽比铰扇蓝线宽大(key1)) {
        setInputHidden(inputs[0], false);
        setInputHidden(inputs[1], true);
        delete data[key1].锁扇铰扇蓝线宽固定差值;
      } else {
        setInputHidden(inputs[0], false);
        setInputHidden(inputs[1], false);
      }
      this.key1Infos[key1] = {
        xiaoguotuInputs: [],
        error: "",
        suanliaoDataParams: {
          选项: {
            型号: componentLrsj.xinghaoName,
            产品分类: componentLrsj.fenleiName,
            工艺做法: componentLrsj.gongyiName,
            包边方向,
            开启,
            门铰锁边铰边: data.名字
          }
        },
        suanliaogongshiInfo: {
          data: {算料公式: data[key1].算料公式, 输入数据: data[key1].输入数据},
          varNames: componentLrsj.varNames
        },
        isLoaded: key1 === "包边在外+外开",
        inputs
      };
      // if (component.parentInfo.isZhijianUser) { // TODO
      // eslint-disable-next-line no-constant-condition
      if (true) {
        this.key1Infos[key1].xiaoguotuInputs = xiaoguotuKeys.map<InputInfo>((key) => {
          return {
            type: "select",
            label: key,
            options: convertOptions(componentLrsj.menshans),
            clearable: true,
            model: {data: data[key1], key},
            optionsDialog: {
              useLocalOptions: true
            },
            style: getInfoStyle(6)
          };
        });
      }
    }
  }

  async submit(close: boolean) {
    if (await this.validate()) {
      const result: MenjiaoOutput = {data: this.formData};
      let refreshSuanliaoTables = false;
      if (this.data.data) {
        const mingziOld = this.data.data.名字;
        const mingziNew = this.formData.名字;
        const {xinghaoName, fenleiName, gongyiName} = this.data.componentLrsj || {};
        if (mingziOld && mingziOld !== mingziNew) {
          const params = {xinghao: xinghaoName, fenlei: fenleiName, gongyi: gongyiName, mingziOld, mingziNew};
          const result = await this.http.getData("shuju/api/onMenjiaoNameChange", params);
          if (result) {
            for (const item of Object.values(this.key1Infos)) {
              item.suanliaoDataParams.选项.门铰锁边铰边 = mingziNew;
            }
            this.data.data.名字 = mingziNew;
            refreshSuanliaoTables = true;
          } else {
            return false;
          }
        }
      }
      this.data.onSubmit?.(result);
      if (close) {
        this.dialogRef.close(result);
        return true;
      } else if (refreshSuanliaoTables) {
        this.suanliaoTablesList?.forEach((v) => v.update());
      }
    } else {
      const {errors} = this;
      if (errors.bcfz && !errors.others) {
        this.message.error("无法保存，输入不完整，请打开板材分组");
      } else {
        this.message.error("无法保存，输入不完整，请补充");
      }
    }
    return false;
  }

  async cancel(confirm: boolean) {
    if (!confirm || (await this.message.confirm("确定不保存关闭吗？"))) {
      this.dialogRef.close();
    }
  }

  autoFill() {
    if (!this.data.componentLrsj) {
      return;
    }
    autoFillMenjiao(this.formData, this.data.componentLrsj.menjiaoOptionsAll);
    this.update(true);
    this.validate();
  }

  async selectCad0(info: typeof this.emptyCadTemplateType) {
    const data = this.formData;
    const {key1, key2, key3} = info;
    const yaoqiu = this.getCadshujuyaoqiu(key3);
    if (!yaoqiu) {
      return;
    }
    const {search, addCadData} = getCadSearch(data, yaoqiu, key1, key2, key3);
    const result = await openCadListDialog(this.dialog, {
      data: {
        selectMode: "single",
        collection: "cad",
        standaloneSearch: true,
        raw: true,
        search,
        addCadData,
        yaoqiu
      }
    });
    const cad = result?.[0] as unknown as HoutaiCad | undefined;
    if (cad) {
      const name = this.cadNameMap[key3] || key3;
      const cadData = new CadData(cad.json);
      cadData.name = name;
      setCadData(cadData, yaoqiu.选中CAD要求);
      if (!data[key1][key2][key3]) {
        data[key1][key2][key3] = {};
      }
      data[key1][key2][key3].cad = getHoutaiCad(cadData);
      updateMenjiaoData(this.formData);
    }
  }

  async selectCad(component: CadItemComponent<MenjiaoCadItemInfo>) {
    await this.selectCad0(component.customInfo);
  }

  async removeCad(component: CadItemComponent<MenjiaoCadItemInfo>) {
    const {key1, key2, key3} = component.customInfo;
    const data = this.formData[key1][key2][key3];
    if (!data.cad || !(await this.message.confirm(`确定删除【${data.cad.名字}】吗？`))) {
      return;
    }
    delete data.cad;
    if (data.企料分体CAD) {
      for (const key of keysOf(data.企料分体CAD)) {
        data.企料分体CAD[key] = null;
      }
    }
    updateMenjiaoData(this.formData);
  }

  async selectShiyituCad(key1: MenjiaoCadType | CadItemComponent<MenjiaoShiyituCadItemInfo>) {
    if (typeof key1 !== "string") {
      key1 = key1.customInfo.key1;
    }
    const data = this.formData[key1].示意图CAD;
    const checkedItems: string[] = [];
    const yaoqiu = await this.status.getCad数据要求("算料单示意图");
    if (!yaoqiu) {
      return;
    }
    for (const item of data.算料单示意图) {
      checkedItems.push(item._id);
    }
    const {search, addCadData} = getShiyituCadSearch(this.formData, key1);
    const result = await openCadListDialog(this.dialog, {
      data: {
        selectMode: "multiple",
        collection: "cad",
        search,
        checkedItems,
        addCadData,
        yaoqiu
      }
    });
    if (result) {
      data.算料单示意图 = result.map((v) => {
        if (!checkedItems.includes(v.id)) {
          setCadData(v, yaoqiu.选中CAD要求);
        }
        return getHoutaiCad(v);
      });
      updateMenjiaoData(this.formData);
    }
  }

  async removeShiyituCad(component: CadItemComponent<MenjiaoShiyituCadItemInfo>) {
    const {key1, index} = component.customInfo;
    const data = this.formData[key1].示意图CAD;
    const cad = data.算料单示意图[index];
    if (!cad || !(await this.message.confirm(`确定删除【${cad.名字}】吗？`))) {
      return;
    }
    data.算料单示意图.splice(index, 1);
    updateMenjiaoData(this.formData);
  }

  async getMrbcjfzDialogInput(key1: MenjiaoCadType): Promise<MrbcjfzDialogInput> {
    const {componentLrsj} = this.data;
    if (!componentLrsj) {
      return {id: -1, table: ""};
    }
    const data = this.formData;
    const morenbancai = cloneDeep(data[key1].板材分组);
    const cads = data[key1].算料CAD.map((v) => new CadData(v.json));
    await componentLrsj.updateHuajians();
    const huajians = componentLrsj.filterHuajians(data[key1]);
    return {
      id: -1,
      table: "",
      inputData: {
        xinghao: componentLrsj.xinghaoName,
        morenbancai,
        cads,
        huajians,
        bancaiList: componentLrsj.bancaiList,
        isLocal: true
      }
    };
  }

  async editBcfz(key1: MenjiaoCadType) {
    const result = await openMrbcjfzDialog(this.dialog, {
      data: await this.getMrbcjfzDialogInput(key1)
    });
    if (result) {
      this.formData[key1].板材分组 = result.data.默认板材;
      console.log(result);
      if (result.submit2) {
        await this.submit(false);
      } else {
        await this.validate();
      }
    }
  }

  getSuanliaoTables(key1: MenjiaoCadType) {
    return this.suanliaoTablesList?.find((v) => {
      const {包边方向, 开启} = v.suanliaoDataParams.选项;
      return key1 === `${包边方向}+${开启}`;
    });
  }

  async editSuanliaoData(key1: MenjiaoCadType) {
    const {componentLrsj, isKailiao, suanliaoTestName} = this.data;
    if (!componentLrsj) {
      return;
    }
    await this.validate();
    if (this.errors.others) {
      await this.message.error("请先填写完整其它数据");
      return;
    }
    componentLrsj.suanliaoDataName = key1;
    componentLrsj.saveInfo();
    const data = this.formData;
    const result = await openSuanliaoDataDialog(this.dialog, {
      data: {
        data: data[key1],
        varNames: componentLrsj.varNames,
        suanliaoDataParams: this.key1Infos[key1].suanliaoDataParams,
        componentLrsj: componentLrsj,
        componentMenjiao: this,
        key1,
        isKailiao,
        suanliaoTestName
      }
    });
    if (result) {
      Object.assign(data[key1], result.data);
      for (const key1 of menjiaoCadTypes) {
        if (this.key1Infos[key1]) {
          this.key1Infos[key1].suanliaogongshiInfo.data = {
            算料公式: data[key1].算料公式,
            输入数据: data[key1].输入数据
          };
        }
      }
      this.getSuanliaoTables(key1)?.update();
    }
    componentLrsj.suanliaoDataName = "";
    this.data.suanliaoTestName = "";
    componentLrsj.saveInfo();
  }

  async copy(key1: MenjiaoCadType) {
    const {componentLrsj} = this.data;
    if (!componentLrsj) {
      return;
    }
    const data = this.formData;
    const suanliaoDataParams = this.key1Infos[key1].suanliaoDataParams;
    const result: MenjiaoCadType | "" | null = await this.message.prompt({
      type: "select",
      label: "从哪个复制",
      options: menjiaoCadTypes.filter((v) => v !== key1),
      validators: Validators.required
    });
    if (!result) {
      return;
    }
    const data2 = data[result];
    data[key1].板材分组 = cloneDeep(data2.板材分组);
    data[key1].算料公式 = cloneDeep(data2.算料公式);
    data[key1].测试用例 = cloneDeep(data2.测试用例);
    data[key1].算料CAD = cloneDeep(data2.算料CAD);
    const from = cloneDeep(suanliaoDataParams);
    const [包边方向2, 开启2] = result.split("+");
    from.选项.包边方向 = 包边方向2;
    from.选项.开启 = 开启2;
    const copyResult = await copySuanliaoData(this.http, data2, data[key1], from, suanliaoDataParams);
    if (copyResult) {
      this.message.snack("复制成功");
      this.getSuanliaoTables(key1)?.update();
    }
  }

  async empty(key1: MenjiaoCadType) {
    if (!(await this.message.confirm("确定清空吗？"))) {
      return;
    }
    const {componentLrsj} = this.data;
    if (!componentLrsj) {
      return;
    }
    const data = this.formData[key1];
    for (const key2 in data.配合框CAD) {
      delete data.配合框CAD[key2].cad;
    }
    for (const key2 in data.企料CAD) {
      delete data.企料CAD[key2].cad;
    }
    data.算料CAD = [];
    data.算料公式 = [];
    data.测试用例 = [];
    data.输入数据 = [];
    for (const item of Object.values(data.板材分组)) {
      item.CAD = [];
    }
    const suanliaoDataParams = this.key1Infos[key1].suanliaoDataParams;
    await this.http.mongodbDelete("kailiaokongweipeizhi", {filter: suanliaoDataParams});
    await this.http.mongodbDelete("kailiaocanshu", {filter: suanliaoDataParams});
    await this.getSuanliaoTables(key1)?.update();
  }

  async validate() {
    const {inputs, formData: data, errors} = this;
    for (const key of keysOf(errors)) {
      errors[key] = false;
    }
    const {errors: inputErrors} = await validateForm(inputs?.toArray() || []);

    const key1Errors = await Promise.all(
      menjiaoCadTypes.map(async (key1) => {
        const menjiaoCadInfos = getMenjiaoCadInfos(data);
        const value = data[key1];
        if (menjiaoCadInfos[key1].isEmpty) {
          const type = key1.split("+")[0];
          if (type === "包边在内") {
            return null;
          } else {
            for (const key11 of menjiaoCadTypes) {
              if (key11 === key1 || !key11.startsWith(type)) {
                continue;
              }
              if (!menjiaoCadInfos[key11].isEmpty) {
                return null;
              }
            }
          }
        }
        const missingValues = [];
        for (const key2 of 算料数据2Keys) {
          for (const key3 in value[key2]) {
            if (!value[key2][key3].cad) {
              missingValues.push(key3);
            }
          }
        }
        const errors2 = [];
        if (missingValues.length > 0) {
          errors2.push("选择" + missingValues.join("、"));
          errors.others = true;
        }
        const mrbcjfzResult = await openMrbcjfzDialog(this.dialog, {
          width: "0",
          height: "0",
          data: {...(await this.getMrbcjfzDialogInput(key1)), dryRun: true}
        });
        if (mrbcjfzResult && mrbcjfzResult.errors.length > 0) {
          errors2.push("检查板材分组");
          errors.bcfz = true;
        }
        if (errors2.length > 0) {
          const error = `请${errors2.join("并")}`;
          this.key1Infos[key1].error = error;
          return {[error]: true};
        } else {
          this.key1Infos[key1].error = "";
          return null;
        }
      })
    );

    if (!isEmpty(inputErrors)) {
      errors.others = true;
      return false;
    }
    if (key1Errors.some((v) => !isEmpty(v))) {
      return false;
    }
    return true;
  }

  getTableCadName(name: string) {
    if (["小扇铰企料", "小扇小锁料"].includes(name)) {
      return name.replace("小扇", "");
    }
    return name;
  }

  async addKwpz(component: CadItemComponent<MenjiaoCadItemInfo>) {
    const {key1} = component.customInfo;
    const suanliaoDataParams = this.key1Infos[key1].suanliaoDataParams;
    const response = await this.http.mongodbInsert("kailiaokongweipeizhi", {
      ...suanliaoDataParams,
      名字: this.getTableCadName(component.cadName)
    });
    if (response) {
      this.getSuanliaoTables(key1)?.updateKlkwpzTable();
    }
  }

  async addKlcs(component: CadItemComponent<MenjiaoCadItemInfo>) {
    const {key1} = component.customInfo;
    const suanliaoDataParams = this.key1Infos[key1].suanliaoDataParams;
    const response = await this.http.mongodbInsert("kailiaocanshu", {
      ...suanliaoDataParams,
      名字: this.getTableCadName(component.cadName) + "中空参数",
      分类: "切中空"
    });
    if (response) {
      this.getSuanliaoTables(key1)?.updateKlcsTable();
    }
  }

  getOpenCadOptions(key1: MenjiaoCadType): CadItemComponent["openCadOptions"] {
    return {
      suanliaogongshiInfo: this.key1Infos[key1].suanliaogongshiInfo,
      suanliaoTablesInfo: {params: this.key1Infos[key1].suanliaoDataParams}
    };
  }

  getFentiDialogInput(key1: MenjiaoCadType, key2: string, key3: string): CadItemComponent["fentiDialogInput"] {
    if (key2 === "企料CAD") {
      return {
        data: this.formData[key1][key2][key3]["企料分体CAD"] || {},
        cadSize: [this.cadWidth, this.cadHeight],
        cad数据要求: this.getCadshujuyaoqiu("企料分体")
      };
    }
    return undefined;
  }

  getCadshujuyaoqiu(type: string) {
    return this.status.getCad数据要求(type);
  }

  afterEditCad(key1: MenjiaoCadType) {
    this.getSuanliaoTables(key1)?.update();
  }

  onMenjiaoCadTabChange(event: MatTabChangeEvent) {
    const label = event.tab.textLabel;
    for (const key of menjiaoCadTypes) {
      if (label.startsWith(key)) {
        this.key1Infos[key].isLoaded = true;
        this.currKey1 = key;
        break;
      }
    }
  }

  getMenjiaoCadTabLabel(key1: MenjiaoCadType) {
    const item = this.formData[key1];
    const isEmpty = () => {
      if (item.算料CAD.length > 0) {
        return false;
      }
      if (Object.values(item.企料CAD).some((v) => v.cad)) {
        return false;
      }
      if (Object.values(item.配合框CAD).some((v) => v.cad)) {
        return false;
      }
      return true;
    };
    let label = key1;
    if (!isEmpty()) {
      label += "（有数据）";
    }
    return label;
  }

  scrollToElement(selector: string) {
    const el = this.el.nativeElement.querySelector(selector);
    if (el) {
      this.inputScrollbar?.scrollToElement(el);
    }
  }

  toggleShowSidebar() {
    this.showSidebar = !this.showSidebar;
    session.save(this.showSidebarKey, this.showSidebar);
  }

  async back1() {
    const {componentLrsj} = this.data;
    if (!(await this.submit(true)) || !componentLrsj) {
      return false;
    }
    await componentLrsj.back();
    return true;
  }

  async back2() {
    const {componentLrsj} = this.data;
    if (!(await this.back1()) || !componentLrsj) {
      return;
    }
    await componentLrsj.back();
    return true;
  }
}

export const openMenjiaoDialog = getOpenDialogFunc<MenjiaoDialogComponent, MenjiaoInput, MenjiaoOutput>(MenjiaoDialogComponent, {
  width: "100%",
  height: "100%"
});
