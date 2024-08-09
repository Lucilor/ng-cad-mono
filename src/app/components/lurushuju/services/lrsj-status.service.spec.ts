import {TestBed} from "@angular/core/testing";
import {provideRouter} from "@angular/router";
import {LrsjStatusService} from "./lrsj-status.service";

describe("LrsjStatusService", () => {
  let service: LrsjStatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });
    service = TestBed.inject(LrsjStatusService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });
});
