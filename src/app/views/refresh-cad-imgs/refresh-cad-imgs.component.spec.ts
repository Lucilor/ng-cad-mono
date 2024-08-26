import {ComponentFixture, TestBed} from "@angular/core/testing";
import {provideAnimations} from "@angular/platform-browser/animations";
import {provideRouter} from "@angular/router";
import {RefreshCadImgsComponent} from "./refresh-cad-imgs.component";

describe("RefreshCadImgsComponent", () => {
  let component: RefreshCadImgsComponent;
  let fixture: ComponentFixture<RefreshCadImgsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefreshCadImgsComponent],
      providers: [provideAnimations(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(RefreshCadImgsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
