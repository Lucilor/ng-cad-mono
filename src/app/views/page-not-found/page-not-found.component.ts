import {ChangeDetectionStrategy, Component, inject, OnInit, signal} from "@angular/core";
import {MatButtonModule} from "@angular/material/button";
import {ActivatedRoute, Router} from "@angular/router";
import {PathResolveData} from "@app/routing/path-resolver";
import {AppStatusService} from "@app/services/app-status.service";

@Component({
  selector: "app-page-not-found",
  templateUrl: "./page-not-found.component.html",
  styleUrls: ["./page-not-found.component.scss"],
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageNotFoundComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private status = inject(AppStatusService);

  data = signal<PathResolveData | null>(null);

  constructor() {
    this.route.data.subscribe((data) => {
      if (data.redirect) {
        this.data.set(data.redirect);
      }
    });
  }

  ngOnInit() {
    this.status.setProject(this.route.snapshot.queryParams);
  }

  redirect() {
    const data = this.data();
    if (!data) {
      return;
    }
    const {path, queryParams} = data;
    this.router.navigate([path], {queryParams});
  }
}
