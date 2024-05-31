import {CdkDrag} from "@angular/cdk/drag-drop";
import {Component, inject} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {ActivatedRoute, ResolveFn, Router, RouterOutlet} from "@angular/router";
import {environment} from "@env";
import {MessageService} from "@modules/message/services/message.service";
import {AppStatusService} from "@services/app-status.service";
import {MessageTestComponent} from "./modules/message/components/message-test/message-test.component";
import {SpinnerComponent} from "./modules/spinner/components/spinner/spinner.component";
import {routesInfo} from "./routing/routes-info";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
  standalone: true,
  imports: [CdkDrag, MatIconModule, MatMenuModule, MessageTestComponent, RouterOutlet, SpinnerComponent]
})
export class AppComponent {
  private dialog = inject(MatDialog);
  private message = inject(MessageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private status = inject(AppStatusService);

  isProd = environment.production;
  routesInfoItems: {info: (typeof routesInfo)[number]; title: ReturnType<AppComponent["getRouteTitle"]>}[];

  constructor() {
    this.routesInfoItems = routesInfo.map((info) => ({info, title: this.getRouteTitle(info)}));
  }

  getRouteTitle(routeInfo: (typeof routesInfo)[number]) {
    const {title, path} = routeInfo;
    if (typeof title === "function") {
      return (title as ResolveFn<string>)(this.route.snapshot, this.router.routerState.snapshot);
    }
    return title || path;
  }

  async changeProject() {
    const project = this.status.project;
    const data = {project: "", clear: false};
    const form = await this.message.form<typeof data>([
      {
        type: "string",
        label: "项目缩写",
        model: {data, key: "project"},
        validators: (control) => {
          const value = control.value;
          if (!data.clear) {
            if (!value) {
              return {required: true};
            }
            if (value === project) {
              return {与当前项目相同: true};
            }
          }
          return null;
        }
      },
      {type: "boolean", label: "清除参数", radio: true, model: {data, key: "clear"}}
    ]);
    if (form) {
      this.status.changeProject(form.项目缩写, form.清除参数);
    }
  }

  navigate(item: (typeof this.routesInfoItems)[number]) {
    this.dialog.closeAll();
    this.router.navigate([item.info.path], {queryParamsHandling: "merge"});
  }
}
