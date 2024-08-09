import {ChangeDetectionStrategy, Component, computed, HostBinding, inject} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {getTableUpdateData} from "@app/modules/http/services/cad-data.service.utils";
import {InputInfo} from "@app/modules/input/components/input.types";
import {MessageService} from "@app/modules/message/services/message.service";
import {environment} from "@env";
import {timeout} from "@lucilor/utils";
import {cloneDeep} from "lodash";
import {NgScrollbarModule} from "ngx-scrollbar";
import {SuanliaoDataBtnName, suanliaoDataBtnNames} from "../lrsj-pieces/lrsj-suanliao-data/lrsj-suanliao-data.types";
import {LrsjStatusService} from "../services/lrsj-status.service";
import {XinghaoGongyi, XinghaoMenchuang} from "../services/lrsj-status.types";
import {getXinghaoGongyi, getXinghaoMenchuang} from "../services/lrsj-status.utils";

@Component({
  selector: "app-lurushuju-nav",
  standalone: true,
  imports: [MatButtonModule, NgScrollbarModule],
  templateUrl: "./lurushuju-nav.component.html",
  styleUrl: "./lurushuju-nav.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LurushujuNavComponent {
  private http = inject(CadDataService);
  private lrsjStatus = inject(LrsjStatusService);
  private message = inject(MessageService);

  @HostBinding("class") class = "ng-page";

  xinghaoMenchuangs = this.lrsjStatus.xinghaoMenchuangs;
  editMode = this.lrsjStatus.editMode;
  xinghao = this.lrsjStatus.xinghao;
  xinghaoFilterStr = this.lrsjStatus.xinghaoFilterStr;
  pieceInfos = this.lrsjStatus.pieceInfos;
  focusFenleiZuofa = this.lrsjStatus.focusFenleiZuofa;
  suanliaoDataInfo = this.lrsjStatus.suanliaoDataInfo;
  production = environment.production;
  menchuangName = computed(() => this.xinghaoMenchuangs().item?.mingzi);
  gongyiName = computed(() => this.xinghaoMenchuangs().item?.gongyis?.item?.mingzi);

  async getXinghaoMenchaung(menchuang?: XinghaoMenchuang) {
    const data = menchuang ? cloneDeep({...menchuang, gongyis: undefined}) : getXinghaoMenchuang();
    const form: InputInfo<typeof data>[] = [
      {
        type: "string",
        label: "名字",
        model: {data, key: "mingzi"},
        validators: Validators.required
      },
      {type: "number", label: "排序", model: {data, key: "paixu"}},
      {type: "boolean", label: "停用", model: {data, key: "tingyong"}}
    ];
    const result = await this.message.form(form);
    return result ? data : null;
  }
  async addXinghaoMenchaung() {
    const data = await this.getXinghaoMenchaung();
    if (data) {
      await this.http.tableInsert({table: "p_menchuang", data});
      await this.lrsjStatus.getXinghaos();
    }
  }
  async editXinghaoMenchaung(i: number) {
    const data0 = this.xinghaoMenchuangs().items[i];
    const data1 = await this.getXinghaoMenchaung(data0);
    if (!data1) {
      return;
    }
    const data = getTableUpdateData(data0, data1);
    if (data) {
      await this.http.tableUpdate({table: "p_menchuang", data});
      await this.lrsjStatus.getXinghaos();
    }
  }
  async removeXinghaoMenchaung(i: number) {
    const data = this.xinghaoMenchuangs().items[i];
    if (data.gongyis && data.gongyis.items.length > 0) {
      this.message.error("门窗存在工艺时不能删除");
      return;
    }
    if (!(await this.message.confirm("确定删除吗？"))) {
      return;
    }
    await this.http.tableDelete({table: "p_menchuang", vids: [data.vid]});
    await this.lrsjStatus.getXinghaos();
  }

  async getXinghaoGongyi(gongyi?: XinghaoGongyi) {
    const data = gongyi ? cloneDeep({...gongyi, xinghaos: undefined}) : getXinghaoGongyi();
    const form: InputInfo<typeof data>[] = [
      {
        type: "string",
        label: "名字",
        model: {data, key: "mingzi"},
        validators: Validators.required
      },
      {type: "number", label: "排序", model: {data, key: "paixu"}},
      {type: "boolean", label: "停用", model: {data, key: "tingyong"}}
    ];
    const result = await this.message.form(form);
    return result ? data : null;
  }
  async addXinghaoGongyi(i: number) {
    const data = await this.getXinghaoGongyi();
    if (data) {
      data.menchuang = this.xinghaoMenchuangs().items[i].vid;
      await this.http.tableInsert({table: "p_gongyi", data});
      await this.lrsjStatus.getXinghaos();
    }
  }
  async editXinghaoGongyi(i: number, j: number) {
    const data0 = this.xinghaoMenchuangs().items[i].gongyis?.items[j];
    const data1 = await this.getXinghaoGongyi(data0);
    if (!data0 || !data1) {
      return;
    }
    const data = getTableUpdateData(data0, data1);
    if (data) {
      await this.http.tableUpdate({table: "p_gongyi", data});
      await this.lrsjStatus.getXinghaos();
    }
  }
  async removeXinghaoGongyi(i: number, j: number) {
    const data = this.xinghaoMenchuangs().items[i].gongyis?.items[j];
    if (!data) {
      return;
    }
    if (data.xinghaos && data.xinghaos.items.length > 0) {
      this.message.error("工艺存在型号时不能删除");
      return;
    }
    if (!(await this.message.confirm("确定删除吗？"))) {
      return;
    }
    await this.http.tableDelete({table: "p_gongyi", vids: [data.vid]});
    await this.lrsjStatus.getXinghaos();
  }

  clickXinghaoGongyi(i: number, j: number) {
    this.lrsjStatus.activateXinghaoGongyi(i, j);
  }

  gotoXinghaos() {
    this.lrsjStatus.gotoXinghaos();
  }

  async clickFenleiZuofa(i: number, j?: number) {
    const show = this.pieceInfos().zuofas.show;
    if (!show) {
      await this.lrsjStatus.gotoZuofas(this.xinghao());
      await timeout(0);
    }
    this.lrsjStatus.focusFenleiZuofa.set({i, j});
  }

  suanliaoDataBtnNames = suanliaoDataBtnNames;
  clickSuanliaoDataBtnName(name: SuanliaoDataBtnName) {
    this.lrsjStatus.triggerSuanliaoDataBtn.set({name});
  }
}
