import {ChangeDetectionStrategy, Component, effect, HostBinding, inject, OnInit, signal} from "@angular/core";
import {Validators} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatDividerModule} from "@angular/material/divider";
import {MatIconModule} from "@angular/material/icon";
import {session, timer} from "@app/app.common";
import {CadDataService} from "@app/modules/http/services/cad-data.service";
import {InputComponent} from "@app/modules/input/components/input.component";
import {InputInfo} from "@app/modules/input/components/input.types";
import {MessageService} from "@app/modules/message/services/message.service";
import {NgScrollbarModule} from "ngx-scrollbar";
import {downloadByString, selectFiles} from "packages/utils/lib";
import {Mode} from "vanilla-jsoneditor";
import {calc, getNum, InputData, OutputData, 优化结果} from "./lvxingcaiyouhua.utils";

@Component({
  selector: "app-lvxingcaiyouhua",
  standalone: true,
  imports: [InputComponent, MatButtonModule, MatDividerModule, MatIconModule, NgScrollbarModule],
  templateUrl: "./lvxingcaiyouhua.component.html",
  styleUrl: "./lvxingcaiyouhua.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LvxingcaiyouhuaComponent implements OnInit {
  private http = inject(CadDataService);
  private message = inject(MessageService);

  @HostBinding("class") class = "ng-page";

  inputs = signal<InputInfo[]>([]);
  inputData = signal<InputData | null>(null);
  qiekousunhao = signal(0);
  outputData = signal<OutputData | null>(null);

  constructor() {
    const dataKey = "lvxingcaiyouhuaData";
    this.inputData.set(session.load<InputData>(dataKey));
    effect(() => {
      const data = this.inputData();
      session.save(dataKey, data);
    });
    const qiekousunhaoKey = "lvxingcaiyouhuaQiekousunhao";
    this.qiekousunhao.set(session.load<number>(qiekousunhaoKey) || 0);
    effect(() => {
      const qiekousunhao = this.qiekousunhao();
      session.save(qiekousunhaoKey, qiekousunhao);
    });
  }

  ngOnInit() {
    this.updateInputs();
  }

  updateInputs() {
    const inputs: ReturnType<typeof this.inputs> = [
      {
        type: "string",
        label: "数据",
        textarea: {autosize: {minRows: 1, maxRows: 2}},
        value: this.inputData() ? JSON.stringify(this.inputData()) : "",
        onChange: (val) => {
          if (val) {
            try {
              this.inputData.set(JSON.parse(val));
            } catch (e) {
              console.error(e);
            }
          } else {
            this.inputData.set(null);
          }
        },
        suffixIcons: [
          {
            name: "edit",
            onClick: async () => {
              const result = await this.message.json(this.inputData(), {options: {mode: Mode.table}});
              if (result) {
                this.inputData.set(result);
              }
            }
          }
        ]
      },
      {type: "number", label: "切口损耗", value: this.qiekousunhao(), onChange: (val) => this.qiekousunhao.set(val)}
    ];
    this.inputs.set(inputs);
  }

  calcResult: {result: OutputData; duration: number} | null = null;
  calcResultInfo: {showDetails: boolean}[] = [];
  calc() {
    const data = this.inputData();
    if (!data) {
      this.message.error("没有数据");
      return;
    }
    const timerKey = "铝型材优化";
    timer.start(timerKey);
    const result = calc(data, this.qiekousunhao());
    const duration = getNum(timer.getDuration(timerKey) || -1);
    timer.end(timerKey, timerKey);
    console.log(result);
    this.calcResult = {result, duration};
    this.calcResultInfo = result.铝型材优化结果.map(() => ({showDetails: true}));
  }
  async import() {
    const files = await selectFiles({accept: ".json"});
    const file = files?.[0];
    if (!file) {
      return;
    }
    const dataStr = await file.text();
    let data: InputData | undefined;
    try {
      data = JSON.parse(dataStr);
    } catch (e) {
      console.error(e);
    }
    if (data) {
      this.inputData.set(data);
      this.updateInputs();
    }
  }
  export() {
    downloadByString(JSON.stringify(this.inputData()), {filename: "铝型材优化.json"});
  }
  async getOptimizeData() {
    const code = await this.message.prompt({type: "string", label: "订单号", validators: Validators.required});
    if (!code) {
      return;
    }
    const data = await this.http.getData<InputData>("xh_interface/getOptimizeData", {code});
    if (!data) {
      return;
    }
    this.inputData.set(data);
    this.updateInputs();
  }

  getLengthsStr(item: 优化结果) {
    const str = item.BOM.map((item) => item.型材长度).join("+");
    return `${item.物料长度}=${str}`;
  }
}
