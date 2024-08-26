import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideRouter} from "@angular/router";
import {PageComponentsDiaplayComponent} from "./page-components-diaplay.component";

describe("PageComponentsDiaplayComponent", () => {
  let component: PageComponentsDiaplayComponent;
  let fixture: ComponentFixture<PageComponentsDiaplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageComponentsDiaplayComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PageComponentsDiaplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
