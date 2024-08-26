import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideAnimations} from "@angular/platform-browser/animations";
import {provideRouter} from "@angular/router";
import {PageConfigComponent} from "./page-config.component";

describe("PageConfigMenuComponent", () => {
  let component: PageConfigComponent;
  let fixture: ComponentFixture<PageConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageConfigComponent],
      providers: [provideAnimations(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(PageConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
