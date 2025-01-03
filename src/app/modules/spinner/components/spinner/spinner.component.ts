import {AfterViewInit, Component, Input, OnInit, ViewChild} from "@angular/core";
import {Subscribed} from "@mixins/subscribed.mixin";
import {SpinnerService} from "@modules/spinner/services/spinner.service";
import {NgxUiLoaderConfig, NgxUiLoaderModule} from "ngx-ui-loader";

@Component({
  selector: "app-spinner",
  templateUrl: "./spinner.component.html",
  styleUrls: ["./spinner.component.scss"],
  imports: [NgxUiLoaderModule]
})
export class SpinnerComponent extends Subscribed() implements OnInit, AfterViewInit {
  @Input() id = "master";
  @Input() text = "";
  @Input() inline = false;
  @Input() config: NgxUiLoaderConfig = {};
  @ViewChild("loader") loader?: any;

  constructor(private spinner: SpinnerService) {
    super();
  }

  ngOnInit() {
    if (this.inline) {
      if (this.config.fgsSize === undefined) {
        this.config.fgsSize = 30;
      }
      if (this.config.hasProgressBar === undefined) {
        this.config.hasProgressBar = false;
      }
    }
    this.subscribe(this.spinner.spinnerShow$, ({id, config}) => {
      if (id === this.id) {
        if (this.inline) {
          this.text = "";
        } else if (config?.text) {
          this.text = config.text;
        }
      }
    });
  }

  ngAfterViewInit() {
    Object.assign(this.loader, this.config);
  }
}
