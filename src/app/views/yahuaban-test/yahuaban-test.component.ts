import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostBinding,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild
} from "@angular/core";
import {toSignal} from "@angular/core/rxjs-interop";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDividerModule} from "@angular/material/divider";
import {ActivatedRoute} from "@angular/router";
import {filePathUrl, getFilepathUrl} from "@app/app.common";
import {Formulas} from "@app/utils/calc";
import {getTrbl, trblItems} from "@app/utils/trbl";
import {FormulasEditorComponent} from "@components/formulas-editor/formulas-editor.component";
import {ShuruTableDataSorted} from "@components/lurushuju/lrsj-pieces/lrsj-zuofa/lrsj-zuofa.types";
import {getShuruItem, getShuruTable} from "@components/lurushuju/lrsj-pieces/lrsj-zuofa/lrsj-zuofa.utils";
import {getInputInfosFromShurus} from "@components/lurushuju/xinghao-data";
import {CadData, CadImage, CadLine, CadViewer} from "@lucilor/cad-viewer";
import {isTypeOf, Point, Rectangle, timeout} from "@lucilor/utils";
import {CadDataService} from "@modules/http/services/cad-data.service";
import {InputComponent} from "@modules/input/components/input.component";
import {InputInfo, InputInfoBoolean} from "@modules/input/components/input.types";
import {getInputInfoGroup, getUnifiedInputs, InputInfoWithDataGetter} from "@modules/input/components/input.utils";
import {MessageService} from "@modules/message/services/message.service";
import {TableComponent} from "@modules/table/components/table/table.component";
import {RowButtonEvent, ToolbarButtonEvent} from "@modules/table/components/table/table.types";
import {CalcService} from "@services/calc.service";
import {Properties} from "csstype";
import {NgScrollbarModule} from "ngx-scrollbar";
import {calcYahuaban, CalcYahuabanConfig, CalcYahuabanResult, YahuabanItem} from "./yahuaban-test.utils";

@Component({
  selector: "app-yahuaban-test",
  imports: [FormsModule, FormulasEditorComponent, InputComponent, MatButtonModule, MatDividerModule, NgScrollbarModule, TableComponent],
  templateUrl: "./yahuaban-test.component.html",
  styleUrl: "./yahuaban-test.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class YahuabanTestComponent implements OnInit, OnDestroy {
  calc = inject(CalcService);
  http = inject(CadDataService);
  message = inject(MessageService);
  route = inject(ActivatedRoute);

  @HostBinding("class") class = "ng-page";

  ngOnInit() {
    window.addEventListener("resize", this.onResize.bind(this));
  }
  ngOnDestroy() {
    window.removeEventListener("resize", this.onResize.bind(this));
    this.destoryCadViewer();
  }
  onResize() {
    this.resizeCadViewer();
  }

  queryParams = toSignal(this.route.queryParams);
  item = signal<YahuabanItem | null>(null);
  filePathUrl = filePathUrl;
  fetchItemEff = effect(async () => {
    const queryParams = this.queryParams();
    if (!queryParams) {
      return;
    }
    const {id} = queryParams;
    if (!id) {
      this.message.error("缺少参数：id");
      return;
    }
    const items = await this.http.getData<YahuabanItem[]>("xh_interface/getYahuabanData", {filter: {where: {vid: id}}});
    const item = items?.[0];
    if (!item) {
      this.message.error(`未找到数据：id=${id}`);
      return;
    }
    this.item.set(item);
  });

  wuliaoInputInfos = computed(() => {
    const item = this.item();
    if (!item) {
      return [];
    }
    const onChange = () => {
      this.item.set({...item});
    };
    const getter = new InputInfoWithDataGetter(item, {onChange});
    const sizeGetter = new InputInfoWithDataGetter(item.guige, {
      onChange: () => {
        item.guige = [...item.guige];
        onChange();
      }
    });
    const liubianGetter = new InputInfoWithDataGetter(item.qiegeliubian, {
      onChange: () => {
        item.qiegeliubian = [...item.qiegeliubian];
        onChange();
      }
    });
    const qiegeGetter = new InputInfoWithDataGetter(item.shangxiazuoyoukeqiegezhi, {
      onChange: () => {
        item.shangxiazuoyoukeqiegezhi = [...item.shangxiazuoyoukeqiegezhi];
        onChange();
      }
    });
    if (!item.gongshishuru || !isTypeOf(item.gongshishuru, "array")) {
      item.gongshishuru = [];
    }
    if (!item.gongshishuruResult || !isTypeOf(item.gongshishuruResult, "object")) {
      item.gongshishuruResult = {};
    }
    const infos: InputInfo[] = [
      getInputInfoGroup([
        sizeGetter.number(0, {label: "宽"}),
        sizeGetter.number(1, {label: "高"}),
        getter.selectSingle("qiegemoshi", [], {label: "切割模式", optionsDialog: {optionKey: "压花板切割模式"}})
      ] as InputInfo[]),
      getInputInfoGroup([
        getUnifiedInputs(
          "切割留边",
          trblItems.map(({name, index}) => liubianGetter.number(index, {label: name})),
          item.qiegeliubian,
          {inputStyle: {flex: "0 0 25%"}}
        ),
        getUnifiedInputs(
          "上下左右可切割值",
          trblItems.map(({name, index}) => qiegeGetter.number(index, {label: name})),
          item.shangxiazuoyoukeqiegezhi,
          {inputStyle: {flex: "0 0 25%"}}
        )
      ])
    ];
    return infos;
  });
  gssrInputInfos = computed(() => {
    const item = this.item();
    if (!item) {
      return [];
    }
    if (!item.gongshishuru || !isTypeOf(item.gongshishuru, "array")) {
      item.gongshishuru = [];
    }
    if (!item.gongshishuruResult || !isTypeOf(item.gongshishuruResult, "object")) {
      item.gongshishuruResult = {};
    }
    return getInputInfosFromShurus(item.gongshishuru, item.gongshishuruResult);
  });

  showGssrTable = signal(false);
  toggleGssrTable() {
    this.showGssrTable.update((v) => !v);
  }
  gssrTableInfo = computed(() => {
    const item = this.item();
    return getShuruTable(item?.gongshishuru || [], {title: "", noScroll: true});
  });
  async onGssrTableToolbar(event: ToolbarButtonEvent) {
    const item = this.item();
    if (!item) {
      return;
    }
    if (!item.gongshishuru || !isTypeOf(item.gongshishuru, "array")) {
      item.gongshishuru = [];
    }
    switch (event.button.event) {
      case "添加":
        {
          const shuruItem = await getShuruItem(this.message, item.gongshishuru);
          if (shuruItem) {
            item.gongshishuru = [...item.gongshishuru, shuruItem];
            this.item.set({...item});
          }
        }
        break;
    }
  }
  async onGssrRow(event: RowButtonEvent<ShuruTableDataSorted>) {
    const item = this.item();
    if (!item) {
      return;
    }
    if (!item.gongshishuru || !isTypeOf(item.gongshishuru, "array")) {
      item.gongshishuru = [];
    }
    const {rowIdx, item: shuruItem} = event;
    switch (event.button.event) {
      case "编辑":
        {
          const shuruItem2 = await getShuruItem(this.message, item.gongshishuru, shuruItem);
          if (shuruItem2) {
            item.gongshishuru[rowIdx] = shuruItem2;
            item.gongshishuru = [...item.gongshishuru];
            this.item.set({...item});
          }
        }
        break;
      case "删除": {
        item.gongshishuru = item.gongshishuru.filter((_, i) => i !== rowIdx);
        this.item.set({...item});
      }
    }
  }

  setItemQiegegongshi(formulas: Formulas | null | undefined) {
    const item = this.item();
    if (!formulas || !item) {
      return;
    }
    this.item.set({...item, qiegegongshi: formulas});
  }

  jiagongInputInfos = computed(() => {
    const item = this.item();
    if (!item) {
      return [];
    }
    const getter = new InputInfoWithDataGetter(item.targetSize, {
      onChange: () => {
        item.targetSize = [...item.targetSize];
        this.item.set({...item});
      }
    });
    const infos: InputInfo[] = [getInputInfoGroup([getter.number(0, {label: "成型宽"}), getter.number(1, {label: "成型高"})])];
    return infos;
  });

  cadContainer = viewChild<ElementRef<HTMLDivElement>>("cadContainer");
  cadViewer = new CadViewer(new CadData(), {backgroundColor: "black", padding: [10], selectMode: "single", minLinewidth: 2});
  initCadViewer = effect(() => {
    const container = this.cadContainer()?.nativeElement;
    if (!container) {
      return;
    }
    const viewer = this.cadViewer;
    viewer.appendTo(container);
    this.resizeCadViewer();
  });
  destoryCadViewer() {
    this.cadViewer.destroy();
  }
  resizeCadViewer() {
    const container = this.cadContainer()?.nativeElement;
    if (!container) {
      return;
    }
    this.cadViewer.resize(container.clientWidth, container.clientHeight);
  }
  addRectToCadViewer(rect: Rectangle, color: Properties["color"]) {
    const viewer = this.cadViewer;
    const {top, right, bottom, left} = rect;
    const es = viewer.data.entities;
    const pts = [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom],
      [left, top]
    ];
    for (let i = 0; i < pts.length - 1; i++) {
      const line = new CadLine();
      line.start.set(pts[i][0], pts[i][1]);
      line.end.set(pts[i + 1][0], pts[i + 1][1]);
      line.setColor(color);
      es.add(line);
    }
  }

  showImg = signal(true);
  useCustomOffset = signal(false);
  customOffset = signal(getTrbl(0));
  customOffsetEff = effect(() => {
    const calcResult = this.calcResult();
    if (calcResult) {
      this.customOffset.set(calcResult.raw.targetOffset);
    } else {
      const item = this.item();
      if (item) {
        const dw = (item.guige[0] - item.targetSize[0]) / 2;
        const dh = (item.guige[1] - item.targetSize[1]) / 2;
        this.customOffset.set([dh, dw, dh, dw]);
      }
    }
  });
  calcConfigInputInfos = computed(() => {
    const item = this.item();
    if (!item) {
      return [];
    }
    const useCustomOffset = this.useCustomOffset();
    const customOffset = this.customOffset();
    const useCustomOffsetInputInfo: InputInfoBoolean = {
      type: "boolean",
      label: "使用输入值",
      appearance: "switch",
      value: useCustomOffset,
      onChange: (val) => this.useCustomOffset.set(val)
    };
    const infos: InputInfo[] = [
      {type: "boolean", label: "显示图片", appearance: "switch", value: this.showImg(), onChange: (val) => this.showImg.set(val)}
    ];
    const calcResult = this.calcResult();
    const calcOffset = calcResult?.raw.targetOffset || customOffset;
    if (useCustomOffset) {
      infos.push(
        getUnifiedInputs(
          "使用输入值",
          trblItems.map(({name, index}) => ({
            type: "number",
            label: `${name}切`,
            value: customOffset[index],
            onChange: (val) => {
              customOffset[index] = val;
              const index2 = (index + 2) % 4;
              const index3 = index === 0 || index === 2 ? 1 : 0;
              customOffset[index2] = item.guige[index3] - item.targetSize[index3] - customOffset[index];
              this.customOffset.set([...customOffset]);
            }
          })),
          customOffset,
          {
            inputStyle: {flex: "0 0 25%"},
            label: "",
            unified: false,
            customToolbar: (unifiedInput) => [useCustomOffsetInputInfo, unifiedInput]
          }
        )
      );
    } else {
      infos.push(
        useCustomOffsetInputInfo,
        getInputInfoGroup(
          trblItems.map(({name, index}) => ({
            type: "number",
            label: `${name}切`,
            value: calcOffset[index],
            readonly: true
          }))
        )
      );
    }
    return infos;
  });
  calcResult = signal<{raw: CalcYahuabanResult; texts: string[]} | null>(null);
  async calcYahuaban() {
    const item = this.item();
    if (!item) {
      return;
    }
    const config: CalcYahuabanConfig = {};
    if (this.useCustomOffset()) {
      config.targetOffset = this.customOffset();
    }
    const res = await calcYahuaban(item, this.calc, config);
    if (!res) {
      return;
    }
    const texts = [trblItems.map(({name, index}) => `${name}切: ${res.targetOffset[index]}`).join(", ")];
    this.calcResult.set({raw: res, texts});
    if (res.errors.length > 0) {
      this.message.error(res.errors.join("<br>"));
    }

    await timeout(0);
    this.resizeCadViewer();
    const viewer = this.cadViewer;
    viewer.data.entities.empty();
    this.addRectToCadViewer(res.rawRect, "white");
    this.addRectToCadViewer(res.liubanRect, "red");
    this.addRectToCadViewer(res.keqiegeRect, "red");
    this.addRectToCadViewer(res.targetRect, "blue");
    if (this.showImg() && item.shiyitu) {
      const cadImage = new CadImage();
      cadImage.url = getFilepathUrl(item.shiyitu);
      cadImage.objectFit = "fill";
      cadImage.position.set(0, 0);
      cadImage.anchor.set(0, 0);
      cadImage.targetSize = new Point(res.rawRect.width, res.rawRect.height);
      cadImage.selectable = false;
      viewer.data.entities.add(cadImage);
    }
    await viewer.reset().render();
    viewer.center();
  }

  async save() {
    const item = this.item();
    if (!item) {
      return;
    }
    await this.http.getData("xh_interface/setYahuabanData", {data: item});
  }
}
