import {ActivatedRouteSnapshot, Params, ResolveFn, RouterStateSnapshot} from "@angular/router";
import {levenshtein} from "@lucilor/utils";
import {routesInfo} from "./routes-info";

export const pathResolver: ResolveFn<PathResolveData> = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const url = state.url.replace(/^\//, "");
  let index = -1;
  for (let i = 0; i < url.length; i++) {
    if (["#", "?"].includes(url[i])) {
      index = i;
      break;
    }
  }
  const typoPath = decodeURIComponent(url.slice(0, index));
  const threshold = typoPath.length < 5 ? 3 : 5;
  const dictionary = routesInfo.filter(({path}) => Math.abs(path.length - typoPath.length) < threshold).map((v) => v.path);

  if (!dictionary.length) {
    return {path: "", queryParams: route.queryParams};
  }

  const pathsDistance = {} as {[name: string]: number};
  dictionary.sort((a, b) => {
    if (!(a in pathsDistance)) {
      pathsDistance[a] = levenshtein(a, typoPath);
    }
    if (!(b in pathsDistance)) {
      pathsDistance[b] = levenshtein(b, typoPath);
    }

    return pathsDistance[a] - pathsDistance[b];
  });

  return {path: `/${dictionary[0]}`, queryParams: route.queryParams};
};

export interface PathResolveData {
  path: string;
  queryParams: Params;
}
