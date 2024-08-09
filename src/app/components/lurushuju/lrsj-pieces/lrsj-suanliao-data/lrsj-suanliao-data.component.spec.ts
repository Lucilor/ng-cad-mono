import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideAnimations} from "@angular/platform-browser/animations";
import {provideRouter} from "@angular/router";
import {LrsjSuanliaoDataComponent} from "./lrsj-suanliao-data.component";

describe("LrsjSuanliaoDataComponent", () => {
  let component: LrsjSuanliaoDataComponent;
  let fixture: ComponentFixture<LrsjSuanliaoDataComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LrsjSuanliaoDataComponent],
      providers: [provideAnimations(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(LrsjSuanliaoDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
