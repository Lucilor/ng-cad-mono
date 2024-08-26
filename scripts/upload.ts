import {ObjectOf} from "@lucilor/utils";
import axios from "axios";
import compressing from "compressing";
import FormData from "form-data";
import fs from "fs";
import minimist from "minimist";
import path from "path";

const postFormData = (url: string, data: ObjectOf<any>, file?: fs.ReadStream) => {
  const formData = new FormData();
  formData.append("data", JSON.stringify(data));
  if (file) {
    formData.append("file", file);
  }
  return axios.post(url, formData, {headers: formData.getHeaders(), maxBodyLength: Infinity});
};

const token = process.env.SERVER_TOKEN;
const args = minimist(process.argv.slice(2));
const host = "https://www.let888.cn";
const targetDir = "../dist/ng-cad2/browser";

const tmpDir = "../.tmp";
const zipName = "upload.zip";
const project = args.beta ? "ng-cad2-beta" : "ng-cad2";

const upload = async () => {
  fs.cpSync(targetDir, path.join(tmpDir, project), {recursive: true});
  await compressing.zip.compressDir(path.join(tmpDir, project), path.join(tmpDir, zipName));
  fs.rmSync(path.join(tmpDir, project), {recursive: true});
  const url = host + "/n/kgs/index/login/upload";
  const data = {dest: "static", token, toDelete: [project], backup: project};
  const response = await postFormData(url, data, fs.createReadStream(path.join(tmpDir, zipName)));
  console.log(response.data);
  if (response.data.code !== 0) {
    throw new Error(response.data.msg);
  }
};
upload();
